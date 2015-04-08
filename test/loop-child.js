var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Loop Execution w/ Child', function () {

  this.timeout(71000);

  var loopWorkflow, childWorkflow, fragment, status, events;

  before(function (done) {

    childWorkflow = usher
      .workflow('child', '_test_workflow_', { taskList: 'test-child-decision-tasklist' });

    childWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .activity('activity4', ['activity3']);

    fragment = usher
      .fragment('loop-child-fragment-workflow')
        .child('child-loop', 'child', '1.0.0');

    loopWorkflow = usher
      .workflow('loop-child', '_test_workflow_', { taskList: 'test-loop-child-decision-tasklist' });

    loopWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .loop('loop1', ['activity1'], fragment, function () {
          return ['test1', 'test2'];
        }, {
          batchDelay: 1,
          itemsPerBatch: 2
        })
        .activity('activity2', ['loop1']);

    loopWorkflow.start();
    childWorkflow.start();

    fixtures.execution.execute('loop-child', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    loopWorkflow.stop();
    childWorkflow.stop();
  });

  it('should execute a looping workflow successfuly', function () {
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
    expect(events.childworkflow_completed('loop1-0-child-loop')).to.be.true;
    expect(events.childworkflow_completed('loop1-1-child-loop')).to.be.true;
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
