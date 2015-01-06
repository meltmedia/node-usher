/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var Gonfalon = require('gonfalon');


module.exports = new Gonfalon('pending', 'resolved', 'scheduled', 'outstanding', 'complete', 'failed', 'terminate');
