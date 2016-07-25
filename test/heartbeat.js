var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Heartbeat', function () {

  this.timeout(71000);

  var activityWorkflow, activityPoller, status, events;

  before(function (done) {

    activityWorkflow = usher
      .workflow('heartbeat-activity', '_test_workflow_', { taskList: 'test-heartbeat-activity-decision-tasklist' });

    activityWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-heartbeat-activity-poller-tasklist'
        })
        .activity('test-long-activity1');

    activityPoller = usher
      .activities('heartbeat-activity-poller', '_test_workflow_', { taskList: 'test-heartbeat-activity-poller-tasklist' })
        .activity('test-long-activity1', '1.0.0', function (task) {
          setTimeout(function () {
            task.success({ activity1: 'Activity 1 output - 1.0.0' });
          }, 38000);
        });

    activityWorkflow.start();
    activityPoller.start();

    fixtures.execution.execute('heartbeat-activity', '1.0.0', { input: 'test input' }, function (err, s, e) {
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
      'test-long-activity1');
    expect(completed).to.be.true;
  });

  it('should verify all activities executed the proper versions', function () {
    expect(events.results('test-long-activity1')).to.deep.equal({ activity1: 'Activity 1 output - 1.0.0' });
  });

});
