/*
 * tst.noleak.js: check that there's no leak in the basic case.
 */

var mod_assert = require('assert');
var mod_fdleakcheck = require('../lib/fdleakcheck');
var fdsBefore;

mod_fdleakcheck.snapshot(function (err, snapshot) {
	if (err) {
		throw (err);
	}

	fdsBefore = snapshot;
	mod_fdleakcheck.snapshot(function (err2, fdsAfter) {
		if (err2) {
			throw (err);
		}

		mod_assert.ok(!fdsBefore.differs(fdsAfter));
		console.log('%s: no leak found', process.argv[1]);
	});
});
