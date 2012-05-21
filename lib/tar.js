var logger = require('./logger'),
    tar = require('tar'),
    Packer = require('./fstream-jam'),
    zlib = require('zlib'),
    path = require('path'),
    fs = require('fs');


/**
 */

exports.create = function(source, target, callback) {

    function returnError(err) {
        // don't call the callback multiple times, just return the first error
        var _callback = callback;
        callback = function () {};
        return _callback(err);
    }

    var fwriter = fs.createWriteStream(target);
    fwriter.on('error', function (err) {
        logger.error('error writing ' + target);
        logger.error(err);
        return returnError(err);
    });
    fwriter.on('close', function () {
        callback(null, target);
    });

    var istream = Packer(source);
    istream.on('error', function (err) {
        logger.error('error reading ' + source);
        logger.error(err);
        return returnError(err);
    });
    istream.on("child", function (c) {
        var root = path.resolve(c.root.path, '../package');
        logger.info('adding', c.path.substr(root.length + 1));
    });

    var packer = tar.Pack();
    packer.on('error', function (err) {
        logger.error('tar creation error ' + target);
        logger.error(err);
        return returnError(err);
    });

    var zipper = zlib.Gzip();
    zipper.on('error', function (err) {
        logger.error('gzip error ' + target);
        logger.error(err);
        return returnError(err);
    });

    istream.pipe(packer).pipe(zipper).pipe(fwriter);
};


/**
 */

exports.extract = function (source, target, callback) {

    function returnError(err) {
        // don't call the callback multiple times, just return the first error
        var _callback = callback;
        callback = function () {};
        return _callback(err);
    }

    var freader = fs.createReadStream(source);
    freader.on('error', function (err) {
        logger.error('error reading ' + source);
        logger.error(err);
        return returnError(err);
    });

    var extractor = tar.Extract({
        type: 'Directory',
        path: target,
        strip: 1,
        filter: function () {
            // symbolic links are not allowed in packages
            if (this.type.match(/^.*Link$/)) {
                logger.warning(
                    'excluding symbolic link',
                    this.path.substr(target.length + 1) + ' -> ' + this.linkpath
                );
                return false;
            }
            return true;
        }
    });
    extractor.on('error', function (err) {
        logger.error('untar error ' + source);
        logger.error(err);
        return returnError(err);
    });
    extractor.on('entry', function (entry) {
        logger.info('extracting', entry.path);
    });
    extractor.on('end', function () {
        return callback(null, target);
    });

    var unzipper = zlib.Unzip();
    unzipper.on('error', function (err) {
        logger.error('unzip error ' + source);
        logger.error(err);
        return returnError(err);
    });

    freader.pipe(unzipper).pipe(extractor);
};