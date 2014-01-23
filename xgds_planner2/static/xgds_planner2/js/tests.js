$(function() {
    test('Tools Tab', function() {
        app.tabs.currentView.setTab('tools');
        equal(app.currentTab, 'tools');
    });

    test('Layers Tab', function() {
        app.tabs.currentView.setTab('layers');
        equal(app.currentTab, 'layers');
    });

    test('Sequence Tab', function() {
        app.tabs.currentView.setTab('sequence');
        equal(app.currentTab, 'sequence');
    });

    test('Meta Tab', function() {
        app.tabs.currentView.setTab('meta');
        equal(app.currentTab, 'meta');
    });
});
