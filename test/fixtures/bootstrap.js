'use strict';

var winston = require('winston'),
    Q = require('q'),
    AWS = require('aws-sdk');


module.exports = {
  setup: setup
};


function setup() {
  var domain = '_test_workflow_';
  registerDomain(domain)
    .then(registerWorkflow(domain, 'workflow'))
    .then(registerActivity(domain, 'activity1'))
    .then(registerActivity(domain, 'activity2'))
    .then(registerActivity(domain, 'activity3'))
    .then(registerActivity(domain, 'activity4'))
    .then(registerActivity(domain, 'activity5'))
    .then(registerActivity(domain, 'activity6'));
}


function registerDomain(name) {
  var defer = Q.defer();
  var swf = new AWS.SimpleWorkflow();

  swf.registerDomain({
      name: name,
      workflowExecutionRetentionPeriodInDays: '1'
    },
    function (err, results) {
      if (err) {
        winston.log('warn', 'Unable to register domain: %s due to: %s', name, err);
      } else {
        winston.log('info', 'Registered domain: %s', name);
      }
      defer.resolve();
  });
  return defer.promise;
}


function registerWorkflow(domain, name) {
  var defer = Q.defer();
  var swf = new AWS.SimpleWorkflow();

  swf.registerWorkflowType({
      domain: domain,
      name: name,
      version: '1.0',
      defaultTaskList: { name: 'test-workflow-decision-tasklist' },
      defaultChildPolicy: 'TERMINATE'
    },
    function (err, results) {
      if (err) {
        winston.log('warn', 'Unable to register workflow: %s due to: %s', name, err);
      } else {
        winston.log('info', 'Registered workflow: %s', name);
      }
      defer.resolve();
  });
  return defer.promise;
}

function registerActivity(domain, name) {
  var defer = Q.defer();
  var swf = new AWS.SimpleWorkflow();

  swf.registerActivityType({
      domain: domain,
      name: name,
      version: '1.0',
      defaultTaskList: { name: 'test-workflow-activity-tasklist' },
      defaultTaskHeartbeatTimeout: '30',
      defaultTaskScheduleToCloseTimeout: '30',
      defaultTaskScheduleToStartTimeout: '30',
      defaultTaskStartToCloseTimeout: '30'
    },
    function (err, results) {
      if (err) {
        winston.log('warn', 'Unable to register activity: %s due to: %s', name, err);
      } else {
        winston.log('info', 'Registered activity: %s', name);
      }
      defer.resolve();
  });
  return defer.promise;
}
