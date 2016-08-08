var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Dynamic Child Execution', function () {

  this.timeout(71000);

  var parentWorkflow, childWorkflow1, childWorkflow2, status, events;

  before(function (done) {
    parentWorkflow = usher
      .workflow('dynamic-parent', '_test_workflow_', { taskList: 'test-dynamic-parent-decision-tasklist' });

    parentWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .child('child1', ['activity1'], {
          workflowType: function () {
            return {
              name: 'dynamic-child-1',
              version: '1.0.0'
            };
          }
        })
        .child('child2', ['activity1'], 'dynamic-child-2', '1.0.0', {
          workflowType: function () {
            return false;
          }
        })
        .activity('activity2', ['child1', 'child2']);

    childWorkflow1 = usher
      .workflow('dynamic-child-1', '_test_workflow_', { taskList: 'test-dynamic-child-1-decision-tasklist' });

    childWorkflow1
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .result('result', ['activity3'], function (input) {
          return input;
        });

    childWorkflow2 = usher
      .workflow('dynamic-child-2', '_test_workflow_', { taskList: 'test-dynamic-child-2-decision-tasklist' });

    childWorkflow2
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity4')
        .result('result', ['activity4'], function (input) {
          return input;
        });

    parentWorkflow.start();
    childWorkflow1.start();
    childWorkflow2.start();

    fixtures.execution.execute('dynamic-parent', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    parentWorkflow.stop();
    childWorkflow1.stop();
    childWorkflow2.stop();
  });

  it('should execute a parent and child workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'child1',
      'child2',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });

    var output1 = {
      "_input": {
        "_input": {
          "input": "test input"
        },
        "_variables": {},
        "activity1": {
          "activity1": "Activity 1 output",
          "input": {
            "_input": {
              "input": "test input"
            },
            "_variables": {}
          }
        }
      },
      "_variables":{},
      "activity3":{"activity3":"Activity 3 output"}
    };
    expect(events.childworkflow_results('child1')).to.deep.equal(output1);

    var output2 = {
      "_input": {
        "_input": {
          "input": "test input"
        },
        "_variables": {},
        "activity1": {
          "activity1": "Activity 1 output",
          "input": {
            "_input": {
              "input": "test input"
            },
            "_variables": {}
          }
        }
      },
      "_variables":{},
      "activity4":{"activity4":"Activity 4 output"}
    };
    expect(events.childworkflow_results('child2')).to.deep.equal(output2);

    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
