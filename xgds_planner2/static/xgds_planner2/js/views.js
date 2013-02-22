app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',

});

app.views.PlanMetaView = Backbone.Marionette.ItemView.extend({
    // Responsible for rendering the "Meta" tab
    template: '#template-meta-tab',
    serializeData: function(){
        data = this.model.toJSON();
        data.sites = app.planLibrary.sites;
        data.platforms = app.planLibrary.platforms;
        return data;
    },
});

app.views.PlanSequenceView = Backbone.Marionette.Layout.extend({
    template: '#template-sequence-view',

    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',

        //Column content
        col1: '#col1',
        col2: '#col2',
        col3: '#col3',
    },

    onRender: function(){
        app.psv = this;
        var sscView = new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence'),   
        });
        //debugger;
        this.col1.show(sscView);
    },

});

app.views.StationListItemView = Backbone.Marionette.ItemView.extend({
    tagName: 'li',
    className: 'station-sequence-item',
    //template: '#template-station-list-item',
    template: function(data){
        return '' + data.id + ' <i/>';
    },
    attributes: function(){
        return {
            'data-item-id': this.model.get('id'),
        };
    },
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    itemView: app.views.SequenceListItemView,
});

app.views.CommandSequenceListItemView = app.views.SequenceListItemView.extend({
    template: function(data){
        return '' + data.typeCode + '<i/>'
    },
});

app.views.CommandSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list command-list',
    itemView: app.views.CommandSequenceListItemView,
});


/*
var commandsByTypeCode = (function(commands){
    var indexed = {};
    _.each(commands, function(command){
        index[command.typeCode] = command;
    });
    return indexed;
})(app.planLibrary.commands);
*/

app.views.CommandPropertiesView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-properties',
    serializeData: function(){
        var data = this.model.toJSON();
        var properties = [];
        _.each( _.pairs(data), function(pair){
            properties.push({
                key: pair[0],
                value: pair[1]
            });
        });
        data.properties = properties;
        return data;
    },
});

app.views.TabNavView = Backbone.Marionette.Layout.extend({
    template: '#template-tabnav',
    regions:{
        tabTarget: '#tab-target',
        tabContent: '#tab-content',
    },
    events: {
        'click ul.nav-tabs li': 'clickSelectTab',
    },

    viewHash: {
        'meta': app.views.PlanMetaView,
        'sequence': app.views.PlanSequenceView,
    },

    initialize: function(){
        this.on('tabSelected', this.setTab);
    },

    onRender: function(){
        if ( ! this.options.initialTab ) {
            this.options.initialTab = "meta";
        }
        this.trigger('tabSelected', this.options.initialTab); 
    },

    clickSelectTab: function(event){
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode); 
    },
    
    setTab: function(tabId) {
        var $tabList = this.$el.find('ul.nav-tabs li');
        $tabList.each(function(){
            li = $(this);
            if ( li.data('target') === tabId ) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewHash[tabId]
        var view = new viewClass({
            model: app.currentPlan,
        });
        this.tabContent.show(view);
        app.router.navigate(tabId);
    },
    
});
