$(function() {
    var mockCrs = {
        'type': 'roversw',
        'properties': {
            'originNorthing': 3893044,
            'originEasting': 573456,
            'projection': 'utm',
            'zone': 11,
            'frame': 'MojaveSiteFrame',
            'zDirection': 'down',
            'label': 'Site Frame',
            'coordinateLabel': 'X, Y'
        }
    };

    var mockCrsOrigin = [-116.193279, 35.177668];

    var closeEnough = function(assert, output, expected,
                               precision) {
        var diff = Math.abs(output - expected);
        assert.ok(diff < precision,
                  output + ' within ' + precision + ' of ' + expected);
    };

    QUnit.test('Tools Tab', function(assert) {
        app.tabs.currentView.setTab('tools');
        assert.equal(app.currentTab, 'tools');
    });

    QUnit.test('Layers Tab', function(assert) {
        app.tabs.currentView.setTab('layers');
        assert.equal(app.currentTab, 'layers');
    });

    QUnit.test('Sequence Tab', function(assert) {
        app.tabs.currentView.setTab('sequence');
        assert.equal(app.currentTab, 'sequence');
    });

    QUnit.test('Meta Tab', function(assert) {
        app.tabs.currentView.setTab('meta');
        assert.equal(app.currentTab, 'meta');
    });

    QUnit.test('CRS to site frame', function(assert) {
        var expected = [0, 0];
        var output = app.util.toSiteFrame(mockCrsOrigin, mockCrs);
        closeEnough(assert, output[0], expected[0], .1);
        closeEnough(assert, output[1], expected[1], .1);
    });

    QUnit.test('Site Frame to CRS', function(assert) {
        var coords = [0, 0];
        var output = app.util.toLngLat(coords, mockCrs);
        closeEnough(assert, output[0], mockCrsOrigin[0], 1e-6);
        closeEnough(assert, output[1], mockCrsOrigin[1], 1e-6);
    });
});
