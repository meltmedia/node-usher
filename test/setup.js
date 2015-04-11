var winston = require('winston'),
    http = require('http'),
    https = require('https'),
    AWS = require('aws-sdk'),
    fixtures = require('./fixtures');

// Bump up the default of 5 so we can do a lot more work at once
http.globalAgent.maxSockets = 500;
https.globalAgent.maxSockets = 500;

// Remove console transport unless we are debugging
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { level: 'silly' });

// Set global AWS configuration
// accessKeyId and secretAccessKey will be pulled in from the environment automaticaly
AWS.config.update({
  region: 'us-west-1',
  sslEnabled: true,
  httpOptions: {
    agent: https.globalAgent,
    timeout: 70000 // Long poll is 60, so 70 should catch problems
  }
});

// Global setup of SWF and Activity Poller across all test cases
before(fixtures.bootstrap.setup);
before(fixtures.activityHandler.start);
after(fixtures.activityHandler.stop);
