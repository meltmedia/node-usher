'use strict';

var winston = require('winston'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk');


module.exports = {
  execute: execute
};


function execute(name, version, input, cb) {
  var workflow = new swf.Workflow({
    'domain': '_test_workflow_',
    'workflowType': {
      'name': name,
      'version': version
    },
    'taskList': { name: 'test-' + name + '-decision-tasklist' },
    'executionStartToCloseTimeout': '10',
    'taskStartToCloseTimeout': '10',
    'childPolicy': 'TERMINATE'
  }, new AWS.SimpleWorkflow({
    httpOptions: {
     timeout: 5000
    }
  }));

  setTimeout(function () {
    winston.log('debug', 'Starting workflow: %s', name);
    var workflowExecution = workflow.start({ input: JSON.stringify(input) }, function (err, id) {
      if (err) {
        return cb(err);
      }

      winston.log('debug', 'Started workflow: %s with execution id: %s', name, id);
      checkStatus(id, workflowExecution.workflowId, cb);
    });
  }, 2000);
}


function checkStatus(runId, workflowId, cb) {
  var client = new AWS.SimpleWorkflow();

  client.describeWorkflowExecution({
      domain: '_test_workflow_',
      execution: {
        runId: runId,
        workflowId: workflowId
      }
    },
    function (err, results) {
      if (err) {
        return cb(err);
      }
      if (results.executionInfo.executionStatus === 'CLOSED') {
        return client.getWorkflowExecutionHistory({
            domain: '_test_workflow_',
            execution: {
              runId: runId,
              workflowId: workflowId
            }
          },
          function (err, events) {
            if (err) {
              return cb(err);
            }
            var eventList = new swf.EventList(events.events);

            return cb(null, results.executionInfo.closeStatus, eventList);
          });
      }

      // If workflow still running, check status again every 200ms
      setTimeout(function () {
        checkStatus(runId, workflowId, cb);
      }, 200);
  });
}
