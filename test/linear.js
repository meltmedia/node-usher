var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Linear Execution', function () {

  this.timeout(71000);

  var linearWorkflow, status, events;

  before(function (done) {
    linearWorkflow = usher
      .workflow('linear', '_test_workflow_', { taskList: 'test-linear-decision-tasklist' });

    linearWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .activity('activity2', ['activity1'])
        .activity('activity3', ['activity2'])
        .activity('activity4', ['activity3'])
        .activity('activity5', ['activity4'])
        .activity('activity6', ['activity5'], {
          taskList: function() {
            return 'test-workflow-activity-tasklist';
          }
        });

    linearWorkflow.start();

    fixtures.execution.execute('linear', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    linearWorkflow.stop();
  });

  it('should execute a linear workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2',
      'activity3',
      'activity4',
      'activity5',
      'activity6');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}}});
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
    expect(events.results('activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('activity5')).to.deep.equal({ activity5: 'Activity 5 output' });
    expect(events.results('activity6')).to.deep.equal({ activity6: 'Activity 6 output' });
  });

});
