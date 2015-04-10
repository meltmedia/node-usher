var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Child Failure Execution', function () {

  this.timeout(91000);

  var parentWorkflow, childWorkflow, status, events;

  before(function (done) {
    parentWorkflow = usher
      .workflow('parent-failure', '_test_workflow_', { taskList: 'test-parent-failure-decision-tasklist' });

    parentWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .child('child1', ['activity1'], 'child-failure', '1.0.0', {
          tagList: function (input) {
            return [input.activity1.activity1];
          },
          ignoreFailures: true
        })
        .activity('activity2', ['child1']);

    childWorkflow = usher
      .workflow('child-failure', '_test_workflow_', { taskList: 'test-child-failure-decision-tasklist' });

    childWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('failure1');

    parentWorkflow.start();
    childWorkflow.start();

    fixtures.execution.execute('parent-failure', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    parentWorkflow.stop();
    childWorkflow.stop();
  });

  it('should execute a parent and child workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
