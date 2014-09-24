var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Activity', function () {

  this.timeout(71000);

  var activityWorkflow, activityPoller, status, events;

  before(function (done) {

    activityWorkflow = usher
      .workflow('activity', '_test_workflow_', { taskList: 'test-activity-decision-tasklist' });

    activityWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-activity-poller-tasklist'
        })
        .activity('test-activity1')
        .activity('test-activity2', ['test-activity1'], { version: '1.1.0' });

    activityPoller = usher
      .activities('activity-poller', '_test_workflow_', { taskList: 'test-activity-poller-tasklist' })
        .activity('test-activity1', '1.0.0', function (task) {
          task.success({ activity1: 'Activity 1 output - 1.0.0' });
        })
        .activity('test-activity1', '1.1.0', function (task) {
          task.success({ activity1: 'Activity 1 output - 1.1.0' });
        })
        .activity('test-activity2', '1.0.0', function (task) {
          task.success({ activity2: 'Activity 2 output - 1.0.0' });
        })
        .activity('test-activity2', '1.1.0', function (task) {
          task.success({ activity2: 'Activity 2 output - 1.1.0' });
        });

    activityWorkflow.start();
    activityPoller.start();

    fixtures.execution.execute('activity', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    if (activityWorkflow) { activityWorkflow.stop(); }
    if (activityPoller) { activityPoller.stop(); }
  });

  it('should execute workflow using defined activities successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'test-activity1',
      'test-activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities executed the proper versions', function () {
    expect(events.results('test-activity1')).to.deep.equal({ activity1: 'Activity 1 output - 1.0.0' });
    expect(events.results('test-activity2')).to.deep.equal({ activity2: 'Activity 2 output - 1.1.0' });
  });

});
