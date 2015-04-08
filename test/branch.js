var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Branch Execution', function () {

  this.timeout(71000);

  var branchWorkflow, status, events;

  before(function (done) {
    branchWorkflow = usher
      .workflow('branch', '_test_workflow_', { taskList: 'test-branch-decision-tasklist' });

    branchWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .activity('activity2', ['activity1'])

        .decision('decision1', ['activity2'], function() {
          return true;
        })
        .activity('activity3', ['decision1'])
        .activity('activity4', ['activity3'])
        .terminate('stop1', ['activity4'])

        .decision('decision2', ['activity2'], function() {
          return false;
        })
        .activity('activity5', ['decision2'])
        .activity('activity6', ['activity5'])
        .terminate('stop2', ['activity6']);

    branchWorkflow.start();

    fixtures.execution.execute('branch', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    branchWorkflow.stop();
  });

  it('should execute the workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2',
      'activity3');
    var notCompleted = events.completed(
      'activity4',
      'activity5',
      'activity6');
    expect(completed).to.be.true;
    expect(notCompleted).to.be.false;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
    expect(events.results('activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
  });

});
