    app.views = app.views || {};

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function(){ app.vent.trigger('mapmode', 'navigate'); },
        'click #btn-reposition': function(){ app.vent.trigger('mapmode', 'reposition'); },
        'click #btn-addStations': function(){ app.vent.trigger('mapmode', 'addStations'); },
    },
    
    initialize: function(){
        app.vent.on('mapmode', this.ensureToggle);
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-'+modeName);
        if ( ! btn.hasClass('active') ) { btn.button('toggle'); }
    },
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

    initialize: function(){
        app.vent.on('showItem', this.showItem, this);
        app.vent.on('showItem:station', this.showStation, this);
        app.vent.on('showItem:segment', this.showSegment, this);
        app.vent.on('showItem:command', this.showCommand, this);
        app.vent.on('showMeta', this.showMeta, this);
        app.vent.on('showPresets', this.showPresets, this);
        app.vent.on('all', function(evt){
            console.log("PlanSequenceView event: "+evt);
        });
    },

    onRender: function(){
        app.psv = this;
        var sscView = new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence'),   
        });
        this.col1.show(sscView);
    },

    showStation: function(itemModel){
        this.col2.close();
        this.col3.close(); // clear the third column

        this.showingStation = itemModel;
        var view = new app.views.CommandSequenceCollectionView( { model: itemModel, collection: itemModel.get('sequence') } );
        this.col2.show( view );
    },

    showSegment: function(itemModel){
        // Display a segment view in col2
        this.col2.close();
        this.col3.close();
        this.col2.show(
            new app.views.PropertiesForm({ model: itemModel })
        );
    },

    showCommand: function(itemModel){
        this.col3.close();
        var view = new app.views.CommandPropertiesFormView( {model: itemModel, readonly: app.options.readonly} );
        this.col3.show(view);
    },

    showMeta: function(model){
        this.col3.show( new app.views.PropertiesForm({
            model: model,
        }) );
    },

    showPresets: function(stationModel) {
        this.col3.show( new app.views.CommandPresetsView({
            model: stationModel,
        }) );
    },

});

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build it's own root element.
    tagName: 'li',
    template: function(data){
        return '' + data.id + ' <i/>';
    },
    attributes: function(){
        return {
            'data-item-id': this.model.get('id'),
            'class': this.model.get('type').toLowerCase() + '-sequence-item',
        };
    },
    events: {
        click: function(){
            this.trigger('select');
            // TODO: Remove this conditional once commands have a useful "type" attribute.
            if ( [ 'Station', 'Segment' ].indexOf(this.model.get('type')) >= 0 ) {
                app.vent.trigger('showItem:'+this.model.get('type').toLowerCase(), this.model);
            } else {
                // Presumably it is a Command
                app.vent.trigger('showItem:command', this.model);
            }
        },
        'all': function(evt){
            // Seems like this never triggers.
            console.log("SequenceListItemView EVENT TRIGGERED", evt);
            console.log("Weird. This never happens.");
        },
    },
    modelEvents: {
        "change": "render", // Re-render when the model changes.
    },
    initialize: function(){
        this.on('select', this.select);
        this.on('unselect', this.unselect);
    },
    onRender: function(){
        if (this.selected){ this.select(); }
    },
    select: function(){
        this.selected = true;
        this.$el.find('i').addClass('icon-chevron-right');
    },
    unselect: function(){
        this.selected = false;
        this.$el.find('i').removeClass('icon-chevron-right');
    },
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    itemView: app.views.SequenceListItemView,
    initialize: function(){
        this.on('itemview:select', function(selectedChildView) {
            this.children.each(function(view){
                if ( view !== selectedChildView) {
                    view.trigger('unselect');
                }
            });
        });
    },
});

app.views.CommandSequenceListItemView = app.views.SequenceListItemView.extend({
    template: function(data){
        return '' + data.presetCode + '<i/>';
    },
    onRender: function(){
        this.$el.css( "background-color", app.request( 'getColor', this.model.get('type') ) );
    },
});

/*
app.views.CommandSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list command-list',
    itemView: app.views.CommandSequenceListItemView,
});
*/
app.views.CommandSequenceCollectionView = Backbone.Marionette.CompositeView.extend({
    template: '#template-sequence-list-station',
    itemView: app.views.CommandSequenceListItemView,
    itemViewContainer: '.sequence-list',
    events: {
        "click .edit-meta": function(){ app.vent.trigger('showMeta', this.model); },
        "click .add-item": function(){ app.vent.trigger('showPresets', this.model); },
    },
});


/*
** PropertiesForm is a hybrid between Marionette.ItemView and Backbone.Form (from the backbone-forms extension).
** Becuase it extends Marionette.ItemView, it can be used cleanly with a region manager.
**
** It has two other import properties:
** 1) It updates its model immediately in response to field value changes.
** 2) It can be made read-only
*/
app.views.PropertiesForm = Backbone.Marionette.ItemView.extend(Backbone.Form.prototype).extend({

    events:{
        'change': 'commit', // Update the associated Model object everytime the form input values change.
    },
    initialize: function(){
        var readonly = this.options.readonly || app.options.readonly;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || _.extend({}, this.options.model.schema);
        var schema = this.options.schema;

        _.each(schema, function(field, key){
            // Objectify any fields that are defined only by a type string
            if (_.isString( field) ) { field = {type: field}; }

            if (readonly) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true,
                };
            }
            schema[key] = field;
        });

        Backbone.Form.prototype.initialize.call(this, this.options);
    },

});


app.views.CommandPropertiesFormView = app.views.PropertiesForm.extend({
    initialize: function(){
        var readonly = this.options.readonly;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        var schema = this.options.schema = {};
        var commandSpec = app.commandSpecs[this.model.get('type')];
        _.each(commandSpec.params, function(param){
            var field = {type: app.models.paramTypeHash[param.valueType]};
            schema[param.id] = field;
        });

        app.views.PropertiesForm.prototype.initialize.call(this, this.options);
    },
});

app.views.CommandPresetsView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets',

    serializeData: function(){
        return {
            presets: app.planLibrary.commands,
            station: this.model.toJSON(),
        }
    },
})


app.views.TabNavView = Backbone.Marionette.Layout.extend({
    template: '#template-tabnav',
    regions:{
        tabTarget: '#tab-target',
        tabContent: '#tab-content',
    },
    events: {
        'click ul.nav-tabs li': 'clickSelectTab',
    },

    viewMap: {
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
        var viewClass = this.viewMap[tabId];
        var view = new viewClass({
            model: app.currentPlan,
        });
        this.tabContent.show(view);
    },
    
});

