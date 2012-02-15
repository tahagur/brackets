/*
 * Copyright 2011 Adobe Systems Incorporated. All Rights Reserved.
 */

/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50*/
/*global $: false, define: false, brackets: false, FileError: false, InvalidateStateError: false */

define(function (require, exports, module) {
    'use strict';

    var NativeFileSystem = {
        
        /** 
         * Amount of time we wait for async calls to return (in milliseconds)
         * Not all async calls are wrapped with something that times out and 
         * calls the error callback. Timeouts are not specified in the W3C spec.
         * @const
         * @type {number}
         */
        ASYNC_TIMEOUT: 2000,
        
        /** showOpenDialog
         *
         * @param {bool} allowMultipleSelection
         * @param {bool} chooseDirectories
         * @param {string} title
         * @param {string} initialPath
         * @param {Array.<string>} fileTypes
         * @param {function(...)} successCallback
         * @param {function(...)} errorCallback
         * @constructor
         */
        showOpenDialog: function (allowMultipleSelection,
                                  chooseDirectories,
                                  title,
                                  initialPath,
                                  fileTypes,
                                  successCallback,
                                  errorCallback) {
            if (!successCallback) {
                return;
            }

            var files = brackets.fs.showOpenDialog(
                allowMultipleSelection,
                chooseDirectories,
                title,
                initialPath,
                fileTypes,
                function (err, data) {
                    if (!err) {
                        successCallback(data);
                    } else if (errorCallback) {
                        errorCallback(NativeFileSystem._nativeToFileError(err));
                    }
                }
            );
        },

        /** requestNativeFileSystem
         *
         * @param {string} path
         * @param {function(...)} successCallback
         * @param {function(...)} errorCallback
         */
        requestNativeFileSystem: function (path, successCallback, errorCallback) {
            brackets.fs.stat(path, function (err, data) {
                if (!err) {
                    // FIXME (issue #247): return a NativeFileSystem object
                    var root = new NativeFileSystem.DirectoryEntry(path);
                    successCallback(root);
                } else if (errorCallback) {
                    errorCallback(NativeFileSystem._nativeToFileError(err));
                }
            });
        },

        _nativeToFileError: function (nativeErr) {
            var error;

            switch (nativeErr) {
                // We map ERR_UNKNOWN and ERR_INVALID_PARAMS to SECURITY_ERR,
                // since there aren't specific mappings for these.
            case brackets.fs.ERR_UNKNOWN:
            case brackets.fs.ERR_INVALID_PARAMS:
                error = FileError.SECURITY_ERR;
                break;
            case brackets.fs.ERR_NOT_FOUND:
                error = FileError.NOT_FOUND_ERR;
                break;
            case brackets.fs.ERR_CANT_READ:
                error = FileError.NOT_READABLE_ERR;
                break;
            // It might seem like you should use FileError.ENCODING_ERR for this,
            // but according to the spec that's for malformed URLs.
            case brackets.fs.ERR_UNSUPPORTED_ENCODING:
                error = FileError.SECURITY_ERR;
                break;
            case brackets.fs.ERR_CANT_WRITE:
                error = FileError.NO_MODIFICATION_ALLOWED_ERR;
                break;
            case brackets.fs.ERR_OUT_OF_SPACE:
                error = FileError.QUOTA_EXCEEDED_ERR;
                break;
            case brackets.fs.PATH_EXISTS_ERR:
                error = FileError.PATH_EXISTS_ERR;
                break;
            default:
                // The HTML file spec says SECURITY_ERR is a catch-all to be used in situations
                // not covered by other error codes. 
                error = FileError.SECURITY_ERR;
            }
            return new NativeFileSystem.FileError(error);
        }
    };

    /** class: Entry
     *
     * @param {string} name
     * @param {string} isFile
     * @constructor
     */
    NativeFileSystem.Entry = function (fullPath, isDirectory) {
        this.isDirectory = isDirectory;
        this.isFile = !isDirectory;
        
        if (fullPath) {
            var lastChar = fullPath.length - 1;
            if (isDirectory && fullPath.charAt(lastChar) === "/") {
                fullPath = fullPath.substr(0, lastChar);
            }
        }
        
        this.fullPath = fullPath;

        // Extract name from fullPath
        this.name = null; // default if extraction fails
        if (fullPath) {
            var pathParts = fullPath.split("/");
            if (pathParts.length > 0) {
                this.name = pathParts.pop();
            }
        }

        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-filesystem
        this.filesystem = null;
    };
    
    NativeFileSystem.Entry.prototype.moveTo = function (parent, newName, successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-moveTo
    };
    
    NativeFileSystem.Entry.prototype.copyTo = function (parent, newName, successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-copyTo
    };
    
    NativeFileSystem.Entry.prototype.toURL = function (mimeType) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-toURL
    };
    
    NativeFileSystem.Entry.prototype.remove = function (successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-remove
    };
    
    NativeFileSystem.Entry.prototype.getParent = function (successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-Entry-remove
    };
    
    NativeFileSystem.Entry.prototype.getMetadata = function (successCallBack, errorCallback) {
        brackets.fs.stat(this.fullPath, function (err, stat) {
            if (err === brackets.fs.NO_ERROR) {
                var metadata = new NativeFileSystem.Metadata(stat.mtime);
                successCallBack(metadata);
            } else {
                errorCallback(NativeFileSystem._nativeToFileError(err));
            }
        });
    };


    /**
     * Stores information about a FileEntry
    */
    NativeFileSystem.Metadata = function (modificationTime) {
        // modificationTime is read only
        this.modificationTime = modificationTime;
    };

    /** class: FileEntry
     * This interface represents a file on a file system.
     *
     * @param {string} name
     * @constructor
     * @extends {Entry}
     */
    NativeFileSystem.FileEntry = function (name) {
        NativeFileSystem.Entry.call(this, name, false);
    };
    NativeFileSystem.FileEntry.prototype = new NativeFileSystem.Entry();

    /**
     * Creates a new FileWriter associated with the file that this FileEntry represents.
     *
     * @param {function (FileWriter)} successCallback
     * @param {function (FileError)} errorCallback
     */
    NativeFileSystem.FileEntry.prototype.createWriter = function (successCallback, errorCallback) {
        var fileEntry = this;

        // [NoInterfaceObject]
        // interface FileWriter : FileSaver
        var FileWriter = function (data) {
            NativeFileSystem.FileSaver.call(this, data);

            // FileWriter private memeber vars
            this._length = 0;
            this._position = 0;
        };

        FileWriter.prototype.length = function () {
            return this._length;
        };

        FileWriter.prototype.position = function () {
            return this._position;
        };

        // TODO (issue #241): handle Blob data instead of string
        FileWriter.prototype.write = function (data) {
            if (!data) {
                throw new Error();
            }

            if (this.readyState === NativeFileSystem.FileSaver.WRITING) {
                throw new NativeFileSystem.FileException(NativeFileSystem.FileException.INVALID_STATE_ERR);
            }

            this._readyState = NativeFileSystem.FileSaver.WRITING;

            if (this.onwritestart) {
                // TODO (issue #241): progressevent
                this.onwritestart();
            }

            var self = this;

            brackets.fs.writeFile(fileEntry.fullPath, data, "utf8", function (err) {

                if ((err !== brackets.fs.NO_ERROR) && self.onerror) {
                    var fileError = NativeFileSystem._nativeToFileError(err);

                    // TODO (issue #241): set readonly FileSaver.error attribute
                    // self._error = fileError;
                    self.onerror(fileError);

                    // TODO (issue #241): partial write, update length and position
                }
                // else {
                    // TODO (issue #241): After changing data argument to Blob, use
                    // Blob.size to update position and length upon successful
                    // completion of a write.

                    // self.position = ;
                    // self.length = ;
                // }

                // DONE is set regardless of error
                self._readyState = NativeFileSystem.FileSaver.DONE;
                
                if (self.onwrite) {
                    // TODO (issue #241): progressevent
                    self.onwrite();
                }

                if (self.onwriteend) {
                    // TODO (issue #241): progressevent
                    self.onwriteend();
                }
            });
        };

        FileWriter.prototype.seek = function (offset) {
        };

        FileWriter.prototype.truncate = function (size) {
        };

        var fileWriter = new FileWriter();

        // initialize file length
        var result = new $.Deferred();
        brackets.fs.readFile(fileEntry.fullPath, "utf8", function (err, contents) {
            // Ignore "file not found" errors. It's okay if the file doesn't exist yet.
            if (err !== brackets.fs.ERR_NOT_FOUND) {
                fileWriter._err = err;
            }
            
            if (contents) {
                fileWriter._length = contents.length;
            }
            
            result.resolve();
        });

        result.done(function () {
            if (fileWriter._err && (errorCallback !== undefined)) {
                errorCallback(NativeFileSystem._nativeToFileError(fileWriter._err));
            } else if (successCallback !== undefined) {
                successCallback(fileWriter);
            }
        });
    };

    /**
     * Obtains the File objecte for a FileEntry object
     *
     * @param {function(...)} successCallback
     * @param {function(...)} errorCallback
     */
    NativeFileSystem.FileEntry.prototype.file = function (successCallback, errorCallback) {
        var newFile = new NativeFileSystem.File(this);
        successCallback(newFile);

        // TODO (issue #241): errorCallback
    };

    /**
     * This interface extends the FileException interface described in to add
     * several new error codes. Any errors that need to be reported synchronously,
     * including all that occur during use of the synchronous filesystem methods,
     * are reported using the FileException exception.
     *
     * @param {number} code The code attribute, on getting, must return one of the
     * constants of the FileException exception, which must be the most appropriate
     * code from the table below.
     */
    NativeFileSystem.FileException = function (code) {
        this.code = code || 0;
    };

    // FileException constants
    Object.defineProperties(
        NativeFileSystem.FileException,
        {
            NOT_FOUND_ERR:                { value: 1, writable: false },
            SECURITY_ERR:                 { value: 2, writable: false },
            ABORT_ERR:                    { value: 3, writable: false },
            NOT_READABLE_ERR:             { value: 4, writable: false },
            ENCODING_ERR:                 { value: 5, writable: false },
            NO_MODIFICATION_ALLOWED_ERR:  { value: 6, writable: false },
            INVALID_STATE_ERR:            { value: 7, writable: false },
            SYNTAX_ERR:                   { value: 8, writable: false },
            QUOTA_EXCEEDED_ERR:           { value: 10, writable: false }
        }
    );

    /**
     * This interface provides methods to monitor the asynchronous writing of blobs
     * to disk using progress events and event handler attributes.
     *
     * This interface is specified to be used within the context of the global
     * object (Window) and within Web Workers.
     *
     * @param {Blob} data
     * @constructor
     */
    NativeFileSystem.FileSaver = function (data) {
        // FileSaver private member vars
        this._data = data;
        this._readyState = NativeFileSystem.FileSaver.INIT;
        this._error = null;
    };

    // FileSaver constants
    Object.defineProperties(
        NativeFileSystem.FileSaver,
        {
            INIT:     { value: 1, writable: false },
            WRITING:  { value: 2, writable: false },
            DONE:     { value: 3, writable: false }
        }
    );

    // FileSaver methods

    /**
     *
     */
    NativeFileSystem.FileSaver.prototype.readyState = function () {
        return this._readyState;
    };

    // TODO (issue #241): http://dev.w3.org/2009/dap/file-system/file-writer.html#widl-FileSaver-abort-void
    NativeFileSystem.FileSaver.prototype.abort = function () {
        // If readyState is DONE or INIT, terminate this overall series of steps without doing anything else..
        if (this._readyState === NativeFileSystem.FileSaver.INIT || this._readyState === NativeFileSystem.FileSaver.DONE) {
            return;
        }

        // TODO (issue #241): Terminate any steps having to do with writing a file.

        // Set the error attribute to a FileError object with the code ABORT_ERR.
        this._error = new NativeFileSystem.FileError(FileError.ABORT_ERR);

        // Set readyState to DONE.
        this._readyState = NativeFileSystem.FileSaver.DONE;

        /*
        TODO (issue #241): 
        Dispatch a progress event called abort
        Dispatch a progress event called writeend
        Stop dispatching any further progress events.
        Terminate this overall set of steps.
        */
    };

    /**
     * This interface represents a directory on a file system.
     *
     * @constructor
     * @param {string} name
     * @extends {Entry}
     */
    NativeFileSystem.DirectoryEntry = function (name) {
        NativeFileSystem.Entry.call(this, name, true);

        // TODO (issue #241): void removeRecursively (VoidCallback successCallback, optional ErrorCallback errorCallback);
    };
    NativeFileSystem.DirectoryEntry.prototype = new NativeFileSystem.Entry();
    
    NativeFileSystem.DirectoryEntry.prototype.getDirectory = function (path, options, successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-DirectoryEntry-getDirectory
    };
    
    NativeFileSystem.DirectoryEntry.prototype.removeRecursively = function (successCallback, errorCallback) {
        // TODO (issue #241)
        // http://www.w3.org/TR/2011/WD-file-system-api-20110419/#widl-DirectoryEntry-removeRecursively
    };

    NativeFileSystem.DirectoryEntry.prototype.createReader = function () {
        var dirReader = new NativeFileSystem.DirectoryReader();
        dirReader._directory = this;

        return dirReader;
    };

    /**
     * Creates or looks up a file.
     *
     * @param {string} path Either an absolute path or a relative path from this
     *        DirectoryEntry to the file to be looked up or created. It is an error
     *        to attempt to create a file whose immediate parent does not yet
     *        exist.
     * @param {Object.<string, boolean>} options
     * @param {function (number)} successCallback
     * @param {function (number)} errorCallback
     */
    NativeFileSystem.DirectoryEntry.prototype.getFile = function (path, options, successCallback, errorCallback) {
        var fileFullPath = path;
        
        // resolve relative paths relative to the DirectoryEntry
        // most absolute paths have a leading slash except Windows which has a drive letter followed by :/
        if (path.charAt(0) !== '/' && path.charAt(1) !== ":") {
            fileFullPath = this.fullPath + "/" + path;
        }

        var createFileEntry = function () {
            if (successCallback) {
                successCallback(new NativeFileSystem.FileEntry(fileFullPath));
            }
        };

        var createFileError = function (err) {
            if (errorCallback) {
                errorCallback(NativeFileSystem._nativeToFileError(err));
            }
        };

        // Use stat() to check if file exists
        brackets.fs.stat(fileFullPath, function (err, stats) {
            if ((err === brackets.fs.NO_ERROR)) {
                // NO_ERROR implies the path already exists

                // throw error if the file the path is a directory
                if (stats.isDirectory()) {
                    if (errorCallback) {
                        errorCallback(new NativeFileSystem.FileError(FileError.TYPE_MISMATCH_ERR));
                    }

                    return;
                }

                // throw error if the file exists but create is exclusive
                if (options.create && options.exclusive) {
                    if (errorCallback) {
                        errorCallback(new NativeFileSystem.FileError(FileError.PATH_EXISTS_ERR));
                    }

                    return;
                }

                // Create a file entry for the existing file. If create == true,
                // a file entry is created without error.
                createFileEntry();
            } else if (err === brackets.fs.ERR_NOT_FOUND) {
                // ERR_NOT_FOUND implies we write a new, empty file

                // create the file
                if (options.create) {
                    brackets.fs.writeFile(fileFullPath, "", "utf8", function (err) {
                        if (err) {
                            createFileError(err);
                        } else {
                            createFileEntry();
                        }
                    });

                    return;
                }

                // throw error if file not found and the create == false
                if (errorCallback) {
                    errorCallback(new NativeFileSystem.FileError(FileError.NOT_FOUND_ERR));
                }
            } else {
                // all other brackets.fs.stat() errors
                createFileError(err);
            }
        });
    };

    /** class: DirectoryReader
     */
    NativeFileSystem.DirectoryReader = function () {

    };

    /** readEntries
     *
     * @param {function(...)} successCallback
     * @param {function(...)} errorCallback
     * @returns {Array.<Entry>}
     */
    NativeFileSystem.DirectoryReader.prototype.readEntries = function (successCallback, errorCallback) {
        var rootPath = this._directory.fullPath;
        brackets.fs.readdir(rootPath, function (err, filelist) {
            if (!err) {
                var i, entries = [], d, deferreds = [];

                // This function is used to create individual functions for each deferred. 
                // These generated functions will add the async result to the right place 
                // in the entries array.
                var genAddToEntriesArrayFunction = function (index) {
                    return function (value) { entries[index] = value; };
                };

                // This function is called to initiate the stat on individual entires.
                // Takes the item's full path and the deferred to resolve with.
                var statEntry = function (itemFullPath, deferred) {
                    brackets.fs.stat(itemFullPath, function (statErr, statData) {
                        if (!statErr) {
                            if (statData.isDirectory()) {
                                deferred.resolve(new NativeFileSystem.DirectoryEntry(itemFullPath));
                            } else if (statData.isFile()) {
                                deferred.resolve(new NativeFileSystem.FileEntry(itemFullPath));
                            } else { // Whatever was returned is neither a file nor a dir, so don't include it.
                                deferred.resolve(null);
                            }
                        } else {
                            deferred.reject(NativeFileSystem._nativeToFileError(statErr));
                        }
                    });
                };
                
                // Create all the deferreds, and start the work executing!
                for (i = 0; i < filelist.length; i++) {
                    d = new $.Deferred();
                    d.done(genAddToEntriesArrayFunction(i));
                    deferreds.push(d);
                    statEntry(rootPath + "/" + filelist[i], d);
                }

                // FIXME (issue #213): -- once we have an async library, it would be good
                // to replace the code below with a library call.
                
                // Get a Promise that depennds on all the individual deferreds finishing.
                var masterPromise = $.when.apply(this, deferreds);
                
                // We want the error callback to get called after some timeout (in case some deferreds don't return).
                // So, we need to wrap masterPromise in another deferred that has this timeout functionality    
                var timeoutWrapper = new $.Deferred();

                var timer = setTimeout(function () {
                    // SECURITY_ERR is the HTML5 File catch-all error, and there isn't anything
                    // more fitting for a timeout.
                    timeoutWrapper.reject(new NativeFileSystem.FileError(FileError.SECURITY_ERR));
                }, NativeFileSystem.ASYNC_TIMEOUT);

                masterPromise.always(function () {
                    clearTimeout(timer); // clear timeout if the masterPromise finishes (with success or error)
                });
                
                // When masterPromise finishes, we want the result to bubble up to timeoutWrapper
                masterPromise.pipe(timeoutWrapper.resolve, timeoutWrapper.reject);
                
                // Add the callbacks to the top-level Promise. The top-level Promise is timeoutWrapper,
                // which wraps masterPromise, which in turn wraps all the individual deferred objects.
                timeoutWrapper.then(
                    function () { // success
                        // The entries array may have null values if stat returned things that were
                        // neither a file nor a dir. So, we need to clean those out.
                        var cleanedEntries = [], i;
                        for (i = 0; i < entries.length; i++) {
                            if (entries[i]) {
                                cleanedEntries.push(entries[i]);
                            }
                        }
                        successCallback(cleanedEntries);
                    },
                    function (err) { // error
                        if (errorCallback) {
                            errorCallback(err);
                        }
                    }
                );

            } else { // There was an error reading the initial directory.
                errorCallback(NativeFileSystem._nativeToFileError(err));
            }
        });
    };

    /** class: FileReader
     *
     * @extends {EventTarget}
     */
    NativeFileSystem.FileReader = function () {
        // TODO (issue #241): this classes should extend EventTarget

        // states
        this.EMPTY = 0;
        this.LOADING = 1;
        this.DONE = 2;

        // readyState is read only
        this.readyState = this.EMPTY;

        // File or Blob data
        // TODO (issue #241): readonly attribute any result;
        // TODO (issue #241): readonly attribute DOMError error;

        // event handler attributes
        this.onloadstart = null;
        this.onprogress = null;
        this.onload = null;
        this.onabort = null;
        this.onerror = null;
        this.onloadend = null;
    };
    // TODO (issue #241): extend EventTarget (draft status, not implememnted in webkit)
    // NativeFileSystem.FileReader.prototype = new NativeFileSystem.EventTarget()
    
    NativeFileSystem.FileReader.prototype.readAsArrayBuffer = function (blob) {
        // TODO (issue #241): implement
        // http://www.w3.org/TR/2011/WD-FileAPI-20111020/#dfn-readAsArrayBuffer
    };
    
    NativeFileSystem.FileReader.prototype.readAsBinaryString = function (blob) {
        // TODO (issue #241): implement
        // http://www.w3.org/TR/2011/WD-FileAPI-20111020/#dfn-readAsBinaryStringAsync
    };
    
    NativeFileSystem.FileReader.prototype.readAsDataURL = function (blob) {
        // TODO (issue #241): implement
        // http://www.w3.org/TR/2011/WD-FileAPI-20111020/#dfn-readAsDataURL
    };
    
    NativeFileSystem.FileReader.prototype.abort = function () {
        // TODO (issue #241): implement
        // http://www.w3.org/TR/2011/WD-FileAPI-20111020/#dfn-abort
    };
    
    /** readAsText
     *
     * @param {Blob} blob
     * @param {string} encoding
     */
    NativeFileSystem.FileReader.prototype.readAsText = function (blob, encoding) {
        var self = this;

        if (!encoding) {
            encoding = "utf-8";
        }

        if (this.readyState === this.LOADING) {
            throw new InvalidateStateError();
        }

        this.readyState = this.LOADING;

        if (this.onloadstart) {
            this.onloadstart(); // TODO (issue #241): progressevent
        }

        brackets.fs.readFile(blob._fullPath, encoding, function (err, data) {

            // TODO (issue #241): the event objects passed to these event handlers is fake and incomplete right now
            var fakeEvent = {
                loaded: 0,
                total: 0
            };

            // The target for this event is the FileReader and the data/err result is stored in the FileReader
            fakeEvent.target = self;
            self.result = data;
            self.error = NativeFileSystem._nativeToFileError(err);

            if (err) {
                self.readyState = self.DONE;
                if (self.onerror) {
                    self.onerror(fakeEvent);
                }
            } else {
                self.readyState = self.DONE;

                // TODO (issue #241): this should be the file/blob size, but we don't have code to get that yet, so for know assume a file size of 1
                // and since we read the file in one go, assume 100% after the first read
                fakeEvent.loaded = 1;
                fakeEvent.total = 1;

                if (self.onprogress) {
                    self.onprogress(fakeEvent);
                }

                // TODO (issue #241): onabort not currently supported since our native implementation doesn't support it
                // if (self.onabort)
                //    self.onabort(fakeEvent);

                if (self.onload) {
                    self.onload(fakeEvent);
                }

                if (self.onloadend) {
                    self.onloadend();
                }
            }

        });
    };

    /** class: Blob
     *
     * @constructor
     * param {Entry} entry
     */
    NativeFileSystem.Blob = function (fullPath) {
        this._fullPath = fullPath;
        
        // TODO (issue #241): implement, readonly
        this.size = 0;
        
        // TODO (issue #241): implement, readonly
        this.type = null;
    };
    
    NativeFileSystem.Blob.prototype.slice = function (start, end, contentType) {
        // TODO (issue #241): implement
        // http://www.w3.org/TR/2011/WD-FileAPI-20111020/#dfn-slice
    };
    
    /** class: File
     *
     * @constructor
     * param {Entry} entry
     * @extends {Blob}
     */
    NativeFileSystem.File = function (entry) {
        NativeFileSystem.Blob.call(this, entry.fullPath);
        
        // TODO (issue #241): implement, readonly
        this.name = "";
        
        // TODO (issue #241): implement, readonly
        this.lastModifiedDate = null;
    };

    /** class: FileError
     *
     * Implementation of HTML file API error code return class. Note that we don't
     * actually define the error codes here--we rely on the browser's built-in FileError
     * class's constants. In other words, external clients of this API should always
     * use FileError.<constant-name>, not NativeFileSystem.FileError.<constant-name>.
     *
     * @constructor
     * @param {number} code The error code to return with this FileError. Must be
     * one of the codes defined in the FileError class.
     */
    NativeFileSystem.FileError = function (code) {
        this.code = code || 0;
    };

    // Define public API
    exports.NativeFileSystem = NativeFileSystem;
});
