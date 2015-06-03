/*
 * fdleakcheck.js: small module for facilitating fd leak checking
 */

var mod_assert = require('assert');
var mod_child = require('child_process');
var mod_extsprintf = require('extsprintf');
var mod_fs = require('fs');
var mod_path = require('path');
var mod_vasync = require('vasync');
var VError = require('verror');
var sprintf = mod_extsprintf.sprintf;

/* Public interface */
exports.snapshot = snapshot;

/*
 * Private class for representing a snapshot.  Do not use these fields directly!
 */
function OpenFdSnapshot()
{
	this.fds_pfiles = null;		/* string output of pfiles(1M) */
	this.fds_openfds = null;	/* array of integers (open fds) */
}

OpenFdSnapshot.prototype.differs = function (rhs)
{
	/*
	 * Users can't get ahold of these objects before they're initialized.
	 */
	mod_assert.ok(this.fds_pfiles !== null);
	mod_assert.ok(this.fds_openfds !== null);
	mod_assert.ok(rhs instanceof OpenFdSnapshot,
	    'cannot call differs() with a non-snapshot');
	mod_assert.ok(rhs.fds_pfiles !== null);
	mod_assert.ok(rhs.fds_openfds !== null);

	/*
	 * The arrays of file descriptors are sorted, so it's sufficient to
	 * convert them to a string and compare that.
	 */
	return (this.fds_openfds.join(',') != rhs.fds_openfds.join(','));
};

OpenFdSnapshot.prototype.openFdsAsString = function ()
{
	mod_assert.ok(this.fds_pfiles !== null);
	return (this.fds_pfiles);
};

/*
 * Uses a combination of pfiles(1M) and proc(4) to list open file descriptors.
 * proc(4) gives us a better programmatic summary for determining whether things
 * are different, but pfiles(1M) is more useful for a human to figure out what
 * the differences are.  To avoid seeing our child process, we avoid
 * communicating with it directly.
 *
 * This function invokes callback(err, result) on completion (where either "err"
 * or "result" is null, as usual).  "result" is an instance of OpenFdSnapshot.
 *
 * If this process is doing anything with file descriptors (e.g., opening files
 * or listening for TCP connections), then these results may be invalid and even
 * inconsistent.
 */
function snapshot(callback)
{
	var lsoutput, pfilesoutput;

	lsoutput = '';
	pfilesoutput = '';

	mod_vasync.waterfall([
	    function listProcFds(subcallback) {
		var procdir, cmd;

		procdir = mod_path.join('/proc', process.pid.toString(), 'fd');
		cmd = sprintf('ls -1 %s', procdir);
		customSpawn(cmd, function (err, output) {
			if (err) {
				subcallback(err);
				return;
			}

			lsoutput = output;
			subcallback();
		});
	    },

	    function runPfiles(subcallback) {
		var cmd;

		cmd = sprintf('pfiles %d', process.pid);
		customSpawn(cmd, function (err, output) {
			if (err) {
				subcallback(err);
				return;
			}

			pfilesoutput = output;
			subcallback();
		});
	    }
	], function (err) {
		var result;

		if (err) {
			callback(new VError(err, 'list open fds'), null);
			return;
		}

		result = new OpenFdSnapshot();
		result.fds_openfds = lsoutput.split(/\n/).filter(
		        function (s) { return (s.length !== 0); }).map(
			function (s) { return (parseInt(s, 10)); }).sort(
			function (a, b) { return (a - b); });
		result.fds_pfiles = pfilesoutput;
		callback(null, result);
	});
}

/*
 * This is a highly specialized function for fork/exec'ing a child process and
 * reading its output without using any new file descriptors in the current
 * process.  "cmd" is passed to "bash -c", so it should not contain shell
 * metacharacters.  "callback" is invoked as callback(err, stdout).  As usual,
 * either "err" or "stdout" is null.  If the child process exits with a non-zero
 * status or is terminated by a signal, an Error is produced.
 */
function customSpawn(cmd, callback)
{
	var output, tmpfile;

	/*
	 * It would be nice to respect the TMP or TMPDIR environment variables,
	 * but we'd have to sanitize them since we pass this path to bash.
	 */
	tmpfile = mod_path.join('/tmp', 'node-fdleakcheck.' + process.pid);
	output = '';

	mod_vasync.waterfall([
	    function spawnChild(subcallback) {
		var child;

		child = mod_child.spawn('bash',
		    [ '-c', sprintf('%s > %s', cmd, tmpfile) ], {
		    'stdio': [ 'ignore', 'ignore', 'ignore' ]
		});
		child.on('error', function (err) {
			subcallback(new VError(err, 'exec "%s"', cmd));
		});
		child.on('exit', function (code, signal) {
			if (signal !== null) {
				subcallback(new VError(
				    'child unexpectedly terminated by ' +
				    'signal %s', signal));
				return;
			}

			if (code !== 0) {
				subcallback(new VError(
				    'child unexpectedly exited with ' +
				    'status %d', code));
				return;
			}

			subcallback();
		});
	    },

	    function readOutput(subcallback) {
		var stream;

		stream = mod_fs.createReadStream(tmpfile);
		stream.on('data', function (chunk) {
			output += chunk.toString('utf8');
		});
		/*
		 * We use "close" instead of "end" because we explicitly care
		 * that this fd is cleaned up before returning to the caller.
		 */
		stream.on('close', function () {
			subcallback();
		});
		stream.on('error', function (err) {
			subcallback(new VError(err, 'read "%s"', tmpfile));
		});
	    },

	    function rmTmpfile(subcallback) {
		mod_fs.unlink(tmpfile, function () { subcallback(); });
	    }
	], function (err) {
		if (err)
			callback(err, null);
		else
			callback(null, output);
	});
}
