# node-fdleakcheck: check for file descriptor leaks

This Node module provides primitives for taking a snapshot of open file
descriptors and comparing two snapshots to determine if there's been a file
descriptor leak.

The implementation is specific to SunOS systems (including SmartOS, OmniOS, and
Solaris), as it relies on [proc(4)](http://illumos.org/man/4/proc) for
correctness and [pfiles(1M)](http://illumos.org/man/1/pfiles) for human-readable
output.

This implementation also depends on child processes (ls, bash, and pfiles).
It's possible to check for fd leaks without this, but not without observing the
leak checker itself.  This module opts for avoiding opening any files itself
during the leak check.


# Synopsis

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

Errors indicate problems creating the snapshot.  Leaks are not turned into
Errors.  It's up to you to use `differs` to compare two snapshots to see if
there's a leak.

Your program should not be doing anything with file descriptors while a
snapshot() operation is oustanding.  If it is, the results of the snapshot are
undefined.


# Contributions

Contributions welcome.  Code should be "make prepush" clean.  To run "make
prepush", you'll need these tools:

* https://github.com/davepacheco/jsstyle
* https://github.com/davepacheco/javascriptlint

If you're changing something non-trivial or user-facing, you may want to submit
an issue first.
