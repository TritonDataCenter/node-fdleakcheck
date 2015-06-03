/*
 * tst.leak.js: check that simple leaks are detected
 */

var mod_assert = require('assert');
var mod_fdleakcheck = require('../lib/fdleakcheck');
var mod_fs = require('fs');
var fdsBefore;

mod_fdleakcheck.snapshot(function (err, snapshot) {
	if (err) {
		throw (err);
	}

	fdsBefore = snapshot;
	var s = mod_fs.createReadStream('/etc/passwd');
	s.on('open', function () {
		mod_fdleakcheck.snapshot(function (err2, fdsAfter) {
			if (err2) {
				throw (err);
			}

			mod_assert.ok(fdsBefore.differs(fdsAfter),
			    'expected leak not found!');
			console.log('%s: leak found (as expected):',
			    process.argv[1]);
			console.log('fds before:');
			console.log(fdsBefore.openFdsAsString());
			console.log('fds after:');
			console.log(fdsAfter.openFdsAsString());
		});
	});
});
