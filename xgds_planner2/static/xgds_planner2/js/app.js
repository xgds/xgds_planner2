var app = (function($, _, Backbone){
    app = new Backbone.Marionette.Application();

    app.addRegions({
        toolbar: '#toolbar',
        map: '#map',
        tabs: 'tabs'
    });
    
    return app;
}(jQuery, _, Backbone));
