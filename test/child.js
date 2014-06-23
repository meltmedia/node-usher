var chai = require('chai'),
    expect = chai.expect,
    swf = require('aws-swf'),
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Child Execution', function () {

  this.timeout(31000);

  var parentWorkflow, childWorkflow, status, events;

  before(function (done) {
    parentWorkflow = usher
      .workflow('parent-workflow', '_test_workflow_', 'test-workflow-decision-tasklist')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .child('child1', ['activity1'], 'workflow2', '1.0')
        .activity('activity2', ['child1']);

    childWorkflow = usher
      .workflow('child-workflow', '_test_workflow_', 'test-workflow2-decision-tasklist')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .activity('activity4', ['activity3']);

    parentWorkflow.start();
    childWorkflow.start();

    fixtures.execution.execute({ input: 'test input' }, function (err, s, e) {
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
      'child1',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output' });
    expect(events.childworkflow_results('child1')).to.deep.equal({"activity3":{"activity3":"Activity 3 output"},"activity4":{"activity4":"Activity 4 output"}});
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
