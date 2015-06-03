/*
 * basic.js: example use of fdleakcheck
 */
var fdleakcheck = require('fdleakcheck');
var fdsBefore;
fdleakcheck.snapshot(function (err, snapshot) {
	if (err) {
		console.error('failed to check fd leaks: %s', err.message);
		return;
	}

	fdsBefore = snapshot;
	/* proceed with operation */
	/* ... */
	/* some time later, after operation */
	fdleakcheck.snapshot(function (err2, fdsAfter) {
		if (err2) {
			console.error('failed to check fd leaks: %s',
			    err2.message);
			return;
		}

		if (fdsBefore.differs(fdsAfter)) {
			console.error('leaks found!');
			console.error('fds open before:');
			console.error(fdsBefore.openFdsAsString());
			console.error('fds open after:');
			console.error(fdsAfter.openFdsAsString());
		} else {
			console.error('no leaks found');
		}
	});
});
