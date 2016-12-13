//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

app.views = app.views || {};
var printedDuration = function(seconds){
		var duration = moment.duration(seconds, 'seconds');
    if (duration.asDays() > 1.0) {
  	return sprintf('%02dd %02d:%02d:%02d (days hh:mm:ss)', duration.days(), duration.hours(), duration.minutes(), duration.seconds());
     }
     else {
  	return sprintf('%02d:%02d:%02d (hh:mm:ss)', duration.hours(), duration.minutes(), duration.seconds());
     }
};

Handlebars.registerHelper('formatDuration', function(seconds){
		return printedDuration(seconds);
	});

Handlebars.registerHelper('formatDistance', function(distance){
	return sprintf('%0.2f m', distance);
});

app.views.ToolbarView = Backbone.Marionette.ItemView.extend({
    template: '#template-toolbar',
    events: {
        'click #btn-navigate': function() { app.vent.trigger('mapmode', 'navigate'); this.updateTip('clear');},
        'click #btn-reposition': function() { app.vent.trigger('mapmode', 'reposition'); this.updateTip('edit'); },
        'click #btn-addStations': function() { app.vent.trigger('mapmode', 'addStations'); this.updateTip('add');},
        'click #btn-save': function() { app.simulatePlan(); app.currentPlan.save() },
        'click #btn-saveas': function() { this.showSaveAsDialog(); },
        'click #btn-undo': function() { app.Actions.undo(); },
        'click #btn-redo': function() { app.Actions.redo(); }
    },

    initialize: function() {
        this.listenTo(app.vent, 'mapmode', this.ensureToggle);
        this.listenTo(app.vent, 'change:plan', function(model) {this.updateSaveStatus('change')});
        this.listenTo(app.currentPlan, 'sync', function(model) {this.updateSaveStatus('sync')});
        this.listenTo(app.currentPlan, 'error', function(model) {this.updateSaveStatus('error')});
        this.listenTo(app.vent, 'clearSaveStatus', function(model) {this.updateSaveStatus('clear')});
        this.listenTo(app.vent, 'readOnly', function(model) {this.updateSaveStatus('readOnly')});
        this.listenTo(app.vent, 'readOnly', this.disableForReadOnly);
        this.listenTo(app.currentPlan, 'sync', this.refreshSaveAs);
        this.listenTo(app.vent, 'undoEmpty', this.disableUndo);
        this.listenTo(app.vent, 'redoEmpty', this.disableRedo);
        this.listenTo(app.vent, 'undoNotEmpty', this.enableUndo);
        this.listenTo(app.vent, 'redoNotEmpty', this.enableRedo);
        this.listenTo(app.currentPlan, 'change:planVersion', this.handleVersionChange);
        this.listenTo(app.vent, 'updatePlanDuration', function() {
        	this.updateDurationDistance();
        });
        this.template = Handlebars.compile($(this.template).html());
    },

    onShow: function() {
        if (!app.State.mapHeightSet) {
            var offset = this.$el.height() +
                parseFloat(this.$el.parent().css('margin-top')) +
                parseFloat(this.$el.parent().css('margin-bottom')) +
                10; // this exact number is needed because jquery ui uses
            // elements with absolute positioning for the resize handles
        	
//            var pageContentElement = $('#page-content');
//            var oldMapHeight = app.map.$el.height();
//            var initialHeight = oldMapHeight - offset;
//            app.map.$el.height(initialHeight);
//            app.map.$el.css('max-height', initialHeight + 'px');
////            $(window).bind('resize', function() {
////                app.map.$el.css('max-height', (pageContentElement.height() - offset) + 'px');
////            });
            //HERETAMAR
            // new stuff
//            var mgic = $("#map-gridstack-item-content");
//        	this.$el.height(mgic.height());
        	// end new stuff

            app.State.mapHeightSet = true;
            app.vent.trigger('doMapResize');
        }
    },
    render: function() {
    	var simInfo = null;
    	if (app.currentPlan) {
    		simInfo = app.currentPlan._simInfo;
    	}
        this.$el.html(this.template({stationMoniker:app.options.stationMoniker,
        							 stationMonikerPlural: app.options.stationMonikerPlural,
        							 simInfo: simInfo}));
    },
    updateDurationDistance: function() {
    	var simInfo = app.currentPlan._simInfo;
    	$("#totalDuration").text(printedDuration(simInfo.deltaTimeSeconds));
    	$("#totalDistance").text(sprintf('%0.2f m', simInfo.deltaDistanceMeters));
    },
    onRender: function() {
        if (app.Actions.undoEmpty()) {
            this.disableUndo();
        } else {
            this.enableUndo();
        }
        if (app.Actions.redoEmpty()) {
            this.disableRedo();
        } else {
            this.enableRedo();
        }
    },

    disableForReadOnly: function() {
        this.$('#btn-addStations').attr('disabled', 'true');
        this.$('#btn-reposition').attr('disabled', 'true');
        this.$('#btn-save').attr('disabled', 'true');
    },

    disableUndo: function() {
        this.$('#btn-undo').attr('disabled', 'true');
    },

    disableRedo: function() {
        this.$('#btn-redo').attr('disabled', 'true');
    },

    enableUndo: function() {
        this.$('#btn-undo').removeAttr('disabled');
    },

    enableRedo: function() {
        this.$('#btn-redo').removeAttr('disabled');
    },

    ensureToggle: function(modeName) {
        var btn = $('#btn-' + modeName);
        if (! btn.hasClass('active')) { 
            btn.prop("checked", true); 
            btn.addClass('active');
        }
        // turn off the others
        btn.siblings().each(function() {
            $(this).prop("checked", false);
            $(this).removeClass("active");
        });
    },

    updateSaveStatus: function(eventName) {
        var msgMap = {
            'change': 'Unsaved changes.',
            'sync': app.options.planMoniker + ' saved.',
            'error': 'Save error.',
            'clear': '',
            'readOnly': app.options.planMoniker + ' is LOCKED.'
        };
        if (app.options.readOnly) {
            eventName = 'readOnly';
        }
        if (eventName == 'change') {
            app.dirty = true;
        } else if (eventName == 'sync') {
            app.dirty = false;
        }

        var msg = msgMap[eventName];
        this.$el.find('#save-status').text(msg);
        if (eventName == 'change' || eventName == 'error' || eventName == 'readOnly') {
            this.$el.find('#save-status').addClass('notify-alert');
        } else {
            this.$el.find('#save-status').removeClass('notify-alert');
        }
    },

    updateTip: function(eventName) {
        var msgMap = {
            'edit': 'Shift click to delete stations, click & drag the blue dot to edit.',
            'add': 'Click to add stations to end.',
            'clear': 'Click and drag to pan map.'
        };
        var msg = msgMap[eventName];
        this.$el.find('#tip-status').text(msg);
    },

    refreshSaveAs: function(model, response) {
        var text = response.responseText;
        if (response.data != null) {
            var newId = response.data;
            if (newId != null) {
                document.location.href = newId;
            } else {
                app.vent.trigger('sync');
            }
        } else {
            app.vent.trigger('sync');
        }
    },

    handleVersionChange: function(model, response) {
        // update the plan id in case the version has changed
        var version = app.currentPlan.get('planVersion');
        if (!_.isUndefined(version)){
            app.currentPlan.set('planVersion', version.toUpperCase());
        } else {
            app.currentPlan.set('planVersion', 'A');
        }
        var planIdTemplate = app.planSchema.planIdFormat;
        var context = {
                plan: app.currentPlan.toJSON()
        };
        var planId = planIdTemplate.format(context);

        app.currentPlan.set('id', planId);
        app.currentPlan.get('sequence').resequence();
    },

    showSaveAsDialog: function() {
        $('#saveAsName').val(app.currentPlan.attributes['name']);
        var version = app.currentPlan.attributes['planVersion'];
        if (version != '') {
            var newVersion = String.fromCharCode(version.charCodeAt(0) + 1).toUpperCase();
        } else {
            var newVersion = 'A';
        }
        $('#saveAsVersion').val(newVersion);
        $('#saveAsNotes').val(app.currentPlan.attributes['notes']);
        $('#saveAsDialog').dialog({
            dialogClass: 'no-close',
            modal: false,
            resizable: true,
            closeOnEscape: true,
            buttons: {
                'Cancel': function() {
                    $(this).dialog('close');
                },
                'Save': function() {
                    var newName = $('#saveAsName').val();
                    var newVersion = $('#saveAsVersion').val();
                    var newNotes = $('#saveAsNotes').val();
                    app.currentPlan.set('planName', newName);
                    app.currentPlan.set('planVersion', newVersion);
                    app.currentPlan.set('name', newName);
                    app.currentPlan.set('notes', newNotes);
                    app.currentPlan.set('uuid', null);
                    app.currentPlan.save();
                    $(this).dialog('close');
                }
            },
            position: {
                my: 'right top',
                at: 'right bottom',
                of: '#tab-buttons'
            },
            dialogClass: 'saveAs'
        });
    }

});

app.views.PlanMetaView = Backbone.Marionette.ItemView.extend({
    // Responsible for rendering the 'Meta' tab
    template: '#template-meta-tab',
    serializeData: function() {
        data = this.model.toJSON();
        data.sites = app.planLibrary.sites;
        data.platforms = app.planLibrary.platforms;
        return data;
    },
    events: {
        'change form#meta': 'updatePlan'
    },
    updatePlan: function(evt) {
        var control = $(evt.target);
        var key = control.attr('name');
        var value = control.val();
        if (key == 'site') {
            value = _.find(app.planLibrary.sites, function(s) { return s.id == value; });
        }
        if (key == 'platform') {
            value = _.find(app.planLibrary.platforms, function(p) { return p.id == value });
        }
        this.model.set(key, value);
    }
});

app.views.PlanSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-plan-sequence-header',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
    	var options = {stationMoniker: app.options.stationMoniker,
 			   		   segmentMoniker: app.options.segmentMoniker,
 			   		   stationMonikerPlural: app.options.stationMonikerPlural,
			   		   segmentMonikerPlural: app.options.segmentMonikerPlural};
        this.$el.html(this.template(options));
    }
});

app.views.StationSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-station-sequence-header',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({stationMoniker: app.options.stationMoniker}));
    },
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._sequenceLabel;
        return data;
    }
});

app.views.SegmentSequenceHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-segment-sequence-header',
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._sequenceLabel;
        return data;
    },
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({segmentMoniker: app.options.segmentMoniker}));
    }
});

app.views.StationPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-station-properties-header',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({stationMoniker: app.options.stationMoniker}));
    }
});

app.views.SegmentPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-segment-properties-header',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({segmentMoniker: app.options.segmentMoniker}));
    }
});

app.views.CommandPropertiesHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-properties-header',
    serializeData: function() {
        var data = this.model.toJSON();
        data.label = this.model._commandLabel;
        return data;
    },
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({commandMoniker: app.options.commandMoniker}));
    }
});

app.views.CommandPresetsHeaderView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets-header',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({commandMoniker: app.options.commandMoniker,
        							 commandMonikerPlural: app.options.commandMonikerPlural}));
    }
});

app.views.PlanSequenceView = Backbone.Marionette.LayoutView.extend({
    template: '#template-sequence-view',
    regions: {
        //Column Headings
        colhead1: '#colhead1',
        colhead2: '#colhead2',
        colhead3: '#colhead3',

        //Column content
        col1: '#col1',
        col2: {
            selector: '#col2',
            regionType: app.views.HideableRegion
        },
        col3: {
            selector: '#col3',
            regionType: app.views.HideableRegion
        }
    },

    initialize: function() {
        //this.listenTo(app.vent, 'showItem', this.showItem, this);
        this.listenTo(app.vent, 'showItem:station', this.showStation, this);
        this.listenTo(app.vent, 'showItem:segment', this.showSegment, this);
        this.listenTo(app.vent, 'showItem:command', this.showCommand, this);
        this.listenTo(app.vent, 'showMeta', this.showMeta, this);
        this.listenTo(app.vent, 'showPresets', this.showPresets, this);
        this.listenTo(app.vent, 'showNothing', this.showNothing, this);
        this.listenTo(app.vent, 'clearSelectedStation', this.clearColumns, this);
        this.listenTo(app.vent, 'updatePlan', this.rerender, this);
    },
    
    onBeforeDestroy: function(data) {
        this.stopListening(app.vent, 'showItem:station');
        this.stopListening(app.vent, 'showItem:segment');
        this.stopListening(app.vent, 'showItem:command');
        this.stopListening(app.vent, 'showMeta');
        this.stopListening(app.vent, 'showPresets');
        this.stopListening(app.vent, 'showNothing');
        this.stopListening(app.vent, 'clearSelectedStation');
	this.stopListening(app.vent, 'updatePlan');
    },

    onClose: function() {
        this.stopListening();
    },
    
    clearColumns: function() {
    	// Clears 2nd and 3rd columns
        this.col2.reset();
        this.col3.reset();
    },
    
    rerender: function() {
        this.colhead1.reset();
        this.col1.reset();
        this.colhead1.show(new app.views.PlanSequenceHeaderView());
        this.col1.show(new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        }));
    },

    onRender: function() {
        app.psv = this;
        try {
            this.colhead1.reset();
            this.col1.reset();
            this.clearColumns();
        } catch (err) {
        }
        this.colhead1.show(new app.views.PlanSequenceHeaderView());
        this.col1.show(new app.views.StationSequenceCollectionView({
            collection: app.currentPlan.get('sequence')
        }));
    },
    
    showStation: function(itemModel) {
        // Clear columns
        try {
            this.col3.reset();
            this.colhead2.reset();
        } catch (ex) {
        }
        var headerView = new app.views.StationSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        this.col2.reset(); 

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('commands')});
        this.col2.show(view);
    },

    showSegment: function(itemModel) {
        try {
            this.col3.reset(); 
            this.colhead2.reset(); 
        } catch (ex) {
        }
        var headerView = new app.views.SegmentSequenceHeaderView({
            model: itemModel
        });
        this.colhead2.show(headerView);
        this.col2.reset(); 

        var view = new app.views.CommandSequenceCollectionView({model: itemModel, collection: itemModel.get('commands')});
        this.col2.show(view);

        this.showMeta(itemModel);
    },

    showCommand: function(itemModel) {
        try {
            this.colhead3.reset();
        } catch (ex) {
        }
        var headerView = new app.views.CommandPropertiesHeaderView({
            model: itemModel
        });
        this.colhead3.show(headerView);
        this.col3.reset(); 
        
        var view = new app.views.PropertiesForm({model: itemModel, readonly: app.options.readOnly});
        this.col3.show(view);
    },

    showMeta: function(model) {
        try {
            this.colhead3.reset(); 
        } catch (ex) {
            
        }
        if (model.get('type') == 'Station') {
            var headerView = new app.views.StationPropertiesHeaderView();
        } else if (model.get('type') == 'Segment') {
            var headerView = new app.views.SegmentPropertiesHeaderView();
        } else if (model.get('type') == 'Command') {
            var headerView = new app.views.CommandPropertiesHeaderView();
        }
        this.colhead3.show(headerView);
        this.col3.reset();
        app.State.metaExpanded = true;
        app.State.addCommandsExpanded = false;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.PropertiesForm({
            model: model
        }));
    },

    showPresets: function(itemModel) {
        try {
            this.colhead3.reset(); 
        } catch (ex) {
        }
        var headerView = new app.views.CommandPresetsHeaderView();
        this.colhead3.show(headerView);
        this.col3.reset(); 
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = true;
        app.State.commandSelected = undefined;
        this.col3.show(new app.views.CommandPresetsView({
            model: itemModel
        }));
    },

    showNothing: function() {
        // clear the columns
        try {
            this.col2.reset(); 
            this.col3.reset(); 
            this.colhead2.reset(); 
            this.colhead3.reset(); 
        } catch (ex) {
            
        }
    }
});

app.views.makeExpandable = function(view, expandClass) {
    /*
     * Call this on a view to indicate it is a expandable item in the three-column layout.
     * When the view's 'expand' event is triggered, it will display it's chevron and trigger
     * the global 'viewExpanded' event.  On recieving a global 'viewExpoanded' event with an
     * expandClass that matches its own, the view will remove it's chevron.
     */
    if (app.currentTab != 'sequence') {
        // memory leak work around
        return;
    }
    var expandable = {
        expand: function() {
            this.trigger('expand');
        },
        _expand: function() {
            var expandClass = this.options.expandClass;
            this.expanded = true;
            this._addIcon();
            app.vent.trigger('viewExpanded', this, expandClass);
            if (!_.isUndefined(this.onExpand) && _.isFunction(this.onExpand)) {
                this.onExpand();
            }
        },
        unexpand: function() {
            //            console.log('(((((((Unexpanding');
            this.expanded = false;
            this.$el.find('i').removeClass('icon-play');
        },
        onExpandOther: function(target, expandClass) {
            //            console.log('Got onExpandOther');
            if (this.options.expandClass === expandClass && this != target && target.isClosed != true) {
                this.unexpand();
                //                console.log('target:');
                //                console.log(target);
            }
        },
        _ensureIcon: function() {
            if (view.$el.find('i').length == 0) {
                view.$el.append('<i/>');
            }
        },
        _restoreIcon: function() {
            //            console.log('!!!!!!!!!!!restoring icon');
            //            console.log('Expanded:', this.expanded);
            if (this.expanded) {
                this._addIcon();
            }
        },
        _addIcon: function() {
            this._ensureIcon();
            this.$el.find('i').addClass('icon-play');
        },
        onClose: function() {
            this.stopListening();
        }
    };
    view = _.defaults(view, expandable);
    view.options = _.defaults(view.options, {expandClass: expandClass});
    view.listenTo(app.vent, 'viewExpanded', view.onExpandOther, view);
    view.on('expand', view._expand, view);
    view.on('render', view._restoreIcon, view);
};

app.views.SequenceListItemView = Backbone.Marionette.ItemView.extend({
    // The list item is a simple enough DOM subtree that we'll let the view build its own root element.
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        app.views.makeExpandable(this, this.options.expandClass);
    },
    template: function(data) {
        //return '' + data.model.toString()+ ' <i/>';
        return '{model.toString} <span class="duration">{timing}</span><i/>'.format(data);
    },
    serializeData: function() {
        var data = Backbone.Marionette.ItemView.prototype.serializeData.call(this, arguments);
        data.model = this.model; // give the serialized object a reference back to the model
        data.view = this; // and view
        return data;
    },
    attributes: function() {
    	try {
	        return {
	            'data-item-id': this.model.cid,
	            'class': this.model.get('type').toLowerCase() + '-sequence-item'
	        };
    	} catch (err){
    		return {};
    	}
    },
    events: {
        click: function() {
            this.expand();
        }
    },
    modelEvents: {
        'change': 'render'
    }
});

app.views.PathElementItemView = app.views.SequenceListItemView.extend({
    events: {
        click: function() {
            app.State.metaExpanded = true;
            app.State.addCommandsExpanded = false;
            app.State.commandSelected = undefined;
            this.expand();
            var type = this.model.get('type'); // "Station" or "Segment"
            app.vent.trigger('showItem:' + type.toLowerCase(), this.model);
        }
    },
    onExpand: function() {
    },
    serializeData: function() {
        var data = app.views.SequenceListItemView.prototype.serializeData.call(this, arguments);
        if (this.model.get('type') == 'Station') {
            data.timing = app.util.secondsToHMS(this.model.getCumulativeDuration());
        } else {
            data.timing = '+' + app.util.secondsToHMS(this.model.getDuration());
        }
        return data;
    }
});

app.views.NoStationsView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-stations',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({stationMoniker: app.options.stationMoniker,
        	                         stationMonikerPlural: app.options.stationMonikerPlural}));
    }
});

app.views.StationSequenceCollectionView = Backbone.Marionette.CollectionView.extend({
    tagName: 'ul',
    className: 'sequence-list station-list',
    childView: app.views.PathElementItemView,
    childViewOptions: {
        expandClass: 'col1'
    },
    emptyView: app.views.NoStationsView,
    initialize: function(options) {
        this.options = options || {};
        // re-render on plan save because for some reason, the collection
        // is re-rendered, reversed, on save.
        //app.State.stationSelected is our state variable
        this.listenTo(app.currentPlan, 'sync', this.render);
        this.listenTo(app.vent, 'station:change', this.render);
        this.listenTo(app.vent, 'station:remove', this.render);
        this.listenTo(app.vent, 'segment:remove', this.render);
        this.listenTo(app.vent, 'plan:reverse', this.render);
        this.on('childview:expand', this.onItemExpand, this);
        //this.on('childview:render', this.restoreExpanded, this);
    },

    onItemExpand: function(childView) {
        app.State.stationSelected = childView.model;
        app.vent.trigger('itemSelected:station', childView.model);
    },

    restoreExpanded: function() {
        if (!_.isUndefined(app.State.stationSelected)) {
            var childView = this.children.findByModel(app.State.stationSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.stationSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // try to look it up by our id
                    childModel = this.collection.findWhere({id:app.State.stationSelected.get('id')});
                }
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.stationSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.stationSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        } else if (!_.isUndefined(app.State.segmentSelected)) {
            var childView = this.children.findByModel(app.State.segmentSelected);
            if (_.isUndefined(childView)) {
                // try to find the child view by ID since models change on save
                var childId = app.State.segmentSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // try to look it up by our id
                    childModel = this.collection.findWhere({id:app.State.segmentSelected.get('id')});
                }
                if (_.isUndefined(childModel)) {
                    // can't find by id, so the view is gone
                    app.State.segmentSelected = undefined;
                    app.vent.trigger('showNothing');
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showNothing');
                    } else {
                        app.State.segmentSelected = childModel;
                        childView.expand();
                        app.vent.trigger('itemSelected:segment', this.model);
                        app.vent.trigger('showItem:' + childModel.get('type').toLowerCase(), childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:' + childView.model.get('type').toLowerCase(), childView.model);
            }
        }
    },

    onRender: function() {
        this.restoreExpanded();
    },

    onClose: function() {
        this.children.each(function(view) {
            view.reset();
        });
    }

});

app.views.CommandItemView = app.views.SequenceListItemView.extend({
    template: function(data) {
        var displayName = data.name || data.presetName || data.presetCode;
        var timing = app.util.secondsToHMS(data.duration);
        return '<input class="select" type="checkbox" id="id_' + displayName + '"/></i>&nbsp;<label style="display:inline-block;" for="id_' + displayName + '">' + displayName + '</label><span class="duration">' + timing + '</span><i/>';
    },
    events: function() {
        return _.extend(app.views.SequenceListItemView.prototype.events, {
            'click input.select': this.toggleSelect
        });
    },
//    initialize: function(options) {
//        this.options = options || {};
//        app.views.SequenceListItemView.prototype.initialize.call(this);
//    },
    onRender: function() {
        this.$el.css('background-color', app.request('getColor', this.model.get('type')));
    },
    onExpand: function() {
        app.vent.trigger('showItem:command', this.model);
    },
    isSelected: function(evt) {
        return this.$el.find('input.select').is(':checked');
    },
    setSelected: function() {
        this.$el.find('input.select').prop('checked', true);
    },
    setUnselected: function() {
        this.$el.find('input.select').prop('checked', false);
    },
    toggleSelect: function(evt) {
        if (this.isSelected()) {
            this.trigger('selected');
        } else {
            this.trigger('unselected');
        }
        evt.stopPropagation();
    },
    onClose: function() {
        this.stopListening();
    }
});

app.views.MiscItemView = app.views.SequenceListItemView.extend({
    tagName: 'li',
    initialize: function(options) {
        this.options = options || {};
        if (this.options.extraClass) {
            this.className = this.className ? this.className + ' ' + this.options.extraClass : this.options.extraClass;
        }
        this.on('click', function() {this.trigger('expand', this, this.options.expandClass);}, this);
        if (this.options.click) {
            this.on('click', this.options.click, this);
        }
        app.views.makeExpandable(this, this.options.expandClass);
    },
    render: function() {
        // override default render behavior with nothing, since contents can be pre-rendered in templates
    }
});

app.views.NoCommandsView = Backbone.Marionette.ItemView.extend({
    template: '#template-no-commands',
    initialize: function() {
        this.template = Handlebars.compile($(this.template).html());
    },
    render: function() {
        this.$el.html(this.template({commandMoniker: app.options.commandMoniker,
        	                         commandMonikerPlural: app.options.commandMonikerPlural}));
    }
});

app.views.CommandSequenceCollectionView = Backbone.Marionette.CompositeView.extend({
    template: '#template-sequence-list-station',
    childView: app.views.CommandItemView,
    childViewContainer: '.command-list',
    childViewOptions: {
        expandClass: 'col2'
    },
    emptyView: app.views.NoCommandsView,
    events: {
        'click #btn-copy': 'copySelectedCommands',
        'click #btn-paste': 'pasteCommands',
        'click #btn-cut': 'cutSelectedCommands',
        'click #btn-delete': 'deleteSelectedCommands',
        'click #btn-kill': 'killStation',
        'click .edit-meta': function(evt) {
            app.vent.trigger('showMeta', this.model);
        },
        'click .add-commands': function(evt) {
            app.vent.trigger('showPresets', this.model);
        },
        'sortstop .command-list': function(evt, ui) {
            var commandOrder = this.$el.find('.command-list').sortable('toArray', {'attribute': 'data-item-id'});
            var oldOrder = this.model.get('sequence').models.map(function(model) {
                return model.cid;
            });
            if (JSON.stringify(commandOrder) == JSON.stringify(oldOrder))
                // no change in order
                return;
            var commandModels = commandOrder.map(function(cid) {
                return this.model.get('commands').filter(function(child) {
                    return child.cid == cid;
                })[0];
            }, this);
            this.model.get('commands').models = commandModels;
            app.vent.trigger('change:plan');
        }
    },
    modelEvents: {
        //'change': 'close' // it's really stupid that we actually have to do this
    },
    initialize: function() {
    	if (this.model != undefined){
	    	this.model.attributes.commandMonikerPlural = app.options.commandMonikerPlural;
	    	if (this.model.attributes.type == 'Station'){
	    		this.model.attributes.itemMoniker = app.options.stationMoniker;
	    	} else {
	    		this.model.attributes.itemMoniker = app.options.segmentMoniker;
	    	}
    	}
        this.head = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
            events: {}
        });
        this.foot = new app.views.MiscItemView({
            model: this.model,
            expandClass: 'col2',
            events: {}
        });
        this.head.setElement(this.$el.find('.edit-meta'));
        this.foot.setElement(this.$el.find('.add-commands'));
        this.head.render();
        this.foot.render();
        app.reqres.setHandler('selectedCommands', this.getSelectedCommands, this);
        app.reqres.setHandler('unselectAllCommands', this.unselectAll, this);
        app.reqres.setHandler('currentPathElement', function() {return this.model;}, this);
        if (_.isUndefined(app.State.metaExpanded))
            app.State.metaExpanded = true;
        if (_.isUndefined(app.State.addCommandsExpanded))
            app.State.addCommandsExpanded = false;
        this.on('childview:expand', this.onItemExpand, this);
        this.on('childview:selected', this.onItemSelected, this);
        this.on('childview:unselected', this.onItemUnSelected, this);
        this.itemsSelected = false;
        //this.on('childView:render', this.restoreExpanded, this);
        this.listenTo(app.vent, 'showMeta', function() {
            this.head.expand();
        });
        this.listenTo(app.vent, 'showPresets', function() {
            this.foot.expand();
        });
        //console.log('++++++new command sequence collection view created');
        //console.log('Presets/Meta/Command:', app.State.addCommandsExpanded,
        //            app.State.metaExpanded, app.State.commandSelected);
        //var stack = new Error().stack;
        //console.log(stack);
        this.listenTo(app.vent, 'commandsSelected', this.enableCommandActions);
        this.listenTo(app.vent, 'commandsUnSelected', this.disableCommandActions);
    },
//    render: function() {
//        this.$el.html(this.template({stationMoniker: app.options.stationMoniker,
//        							 commandMoniker: app.options.commandMoniker,
//        							 commandMonikerPlural: app.options.commandMonikerPlural}));
//    },
    onItemSelected: function() {
        if (this.itemsSelected) return;
        if (!_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = true;
            app.vent.trigger('commandsSelected');
        }
    },

    onItemUnSelected: function() {
        if (!this.itemsSelected) return;
        if (_.isEmpty(this.getSelectedCommands())) {
            this.itemsSelected = false;
            app.vent.trigger('commandsUnSelected');
        }
    },

    getSelectedCommands: function() {
        var commands = [];
        this.children.each(function(childView) {
            try {
                if (childView.isSelected()) { commands.push(childView.model); }
            } catch(ex) {
                //pass
            }
            
        });
        return commands;
    },

    getCommandCollection: function() {
        return this.collection;
    },

    unselectAll: function() {
        if (!_.isEmpty(this.children)) {
            this.children.each(function(view) {
                if (!_.isUndefined(view)){
                    view.setUnselected();
                }
            });
        }
    },

    onItemExpand: function(childView) {
        app.State.commandSelected = childView.model;
        app.State.metaExpanded = false;
        app.State.addCommandsExpanded = false;
    },

    restoreExpanded: function() {
        //console.log('restoring closed view:', this.isClosed);
        if (app.State.metaExpanded) {
            app.vent.trigger('showMeta', this.model);
        } else if (app.State.addCommandsExpanded) {
            //console.log('----expanding foot');
            app.vent.trigger('showPresets', this.model);
            //console.log(this.foot.expanded);
        } else if (!_.isUndefined(app.State.commandSelected)) {
            var childView = this.children.findByModel(app.State.commandSelected);
            if (_.isUndefined(childView)) {
                // try to find the model by id
                var childId = app.State.commandSelected.cid;
                var childModel = this.collection.get(childId);
                if (_.isUndefined(childModel)) {
                    // can't find by id, so view is gone
                    app.vent.trigger('showMeta', this.model);
                } else {
                    childView = this.children.findByModel(childModel);
                    if (_.isUndefined(childView)) {
                        // the model isn't in our list, oh noes!
                        app.vent.trigger('showMeta', this.model);
                    } else {
                        app.State.commandSelected = childModel;
                        childView.expand();
                        app.vent.trigger('showItem:command', childModel);
                    }
                }
            } else {
                // restore expanded state
                childView.expand();
                app.vent.trigger('showItem:command', childView.model);
            }
        }
    },

    onRender: function() {
        //var container = this.$el.find('.sequence-list');
        //container.prepend(this.head.el);
        //container.append(this.foot.el);
//        this.head.setElement(this.$el.find('.edit-meta'));
//        this.foot.setElement(this.$el.find('.add-commands'));
//        this.head.render();
//        this.foot.render();
	if (!this.isEmpty()){
	        this.$el.find('.command-list').sortable();
	}
        this.restoreExpanded();
        if (app.hasHandler('selectedCommands') &&
                !_.isEmpty(app.request('selectedCommands'))) {
                this.enableCommandActions();
            } else {
                this.disableCommandActions();
            }
    },

    onClose: function() {
        //console.log('command sequence closed');
        //var stack = new Error().stack;
        //console.log(stack);
        this.head.reset();
        this.foot.reset();
        this.children.each(function(view) {
            view.reset();
        });
        this.stopListening();
    },
    disableCommandActions: function() {
        this.$('#btn-copy').attr('disabled', 'true');
        if (!_.isEmpty(app.copiedCommands)){
            this.$('#btn-paste').removeAttr('disabled');
        } else {
            this.$('#btn-paste').attr('disabled', 'true');
        }
        this.$('#btn-cut').attr('disabled', 'true');
        this.$('#btn-delete').attr('disabled', 'true');
    },

    enableCommandActions: function() {
        this.$('#btn-copy').removeAttr('disabled');
        this.$('#btn-paste').removeAttr('disabled');
        this.$('#btn-cut').removeAttr('disabled');
        this.$('#btn-delete').removeAttr('disabled');
    },
    deleteSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        var selectParent = null;
        if (commands.length > 0){
            selectParent = commands[0].get('pathElement');
        }
        _.each(commands, function(command) {
            if (!_.isUndefined(command.collection)){
                command.collection.remove(command);
            }
            command.destroy();
        });
        app.vent.trigger('change:plan');
        if (selectParent != null){
            var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
            app.vent.trigger(showParent, selectParent);
        }
    },
    
    killStation: function() {
    	if (!_.isUndefined(this.model) && this.model.get('type') == 'Station') {
    		var thePlan = this.model.get('plan');
    		var theSequence = thePlan.get('sequence');
    		var killedSegment = theSequence.removeStation(this.model);
    		app.vent.trigger('itemSelected:station', null);
    		app.vent.trigger('clearSelectedStation', null);
    	}
    },

    copySelectedCommands: function() {
        var commands = app.request('selectedCommands');
        app.copiedCommands = new Array();
        app.copiedCommands.push.apply(app.copiedCommands, commands);
        app.request('unselectAllCommands');
    },

    pasteCommands: function() {
        var model = app.request('currentPathElement');
        var commands = model.get('commands');
        var type = model.get('type');
        var cut = app.request('cutAfterPaste');
        _.each(app.copiedCommands, function(command) {
        	commands.add(command.clone());
            //TODO now you can paste a command into a container that should not contain it. Verify permitted, or validate.
            /*
            if (cut) {
                commands.add(command.clone());
            } else if (command.get('pathElement').get('type') == type) {
                commands.add(command.clone());
            } */
            
        });
        app.vent.trigger('change:plan');
    },

    cutSelectedCommands: function() {
        var commands = app.request('selectedCommands');
        if (commands.length > 0){
            app.copiedCommands = new Array();
            app.copiedCommands.push.apply(app.copiedCommands, commands);
            
            // remove them from the collection
            var selectParent = null;
            selectParent = commands[0].get('pathElement');
            _.each(commands, function(command) {
                if (!_.isUndefined(command.collection)){
                    command.collection.remove(command);
                }
            });
            app.vent.trigger('change:plan');
            if (selectParent != null){
                var showParent = 'showItem:' + selectParent.get('type').toLowerCase();
                app.vent.trigger(showParent, selectParent);
            }
            
            app.request('unselectAllCommands');
            app.vent.trigger('cutAfterPaste');
        }
    }
    
    
});

/*
** PropertiesForm is a hybrid between Marionette.ItemView and Backbone.Form (from the backbone-forms extension).
** Becuase it extends Marionette.ItemView, it can be used cleanly with a region manager.
**
** It has two other important properties:
** 1) It updates its model immediately in response to field value changes.
** 2) It can be made read-only
*/
app.views.PropertiesForm = Backbone.Marionette.ItemView.extend(Backbone.Form.prototype).extend({
    template: '#template-properties-form',

    events: {
        'change': 'commitCheck'
    },

    modelEvents: {
        'change': 'update'
    },

    initialize: function(options) {
        this.options = options || {};
        var readOnly = this.options.readOnly || app.options.readOnly;
        var visible = this.options.visible;

        // Construct a schema compatible with backbone-forms
        // https://github.com/powmedia/backbone-forms#schema-definition
        this.options.schema = this.options.schema || this.options.model.schema;
        this.options.data = this.options.data || this.options.model.data;
        this.Field = Backbone.Form.UnitField;
        this.template = Handlebars.compile($(this.template).html());
        var schema = this.options.schema;

        if (readOnly) {
            _.each(schema, function(field, key) {
                field.editorAttrs = {
                    readonly: true,
                    disabled: true
                };
                schema[key] = field;
            });
        }
        Backbone.Form.prototype.initialize.call(this, this.options);
        
    },

    commitCheck: function() {
        Backbone.Form.prototype.commit.apply(this, arguments);
    },

    update: function() {
        var attrs = this.model.changedAttributes();
        _.each(_.keys(attrs), function(k) {
            var v = attrs[k];
            this.setValue(k, v);
        }, this);
    }
});

app.views.CommandPresetsView = Backbone.Marionette.ItemView.extend({
    template: '#template-command-presets',

    serializeData: function() {
        return {
            presets: this.getRelevantPresets(),
            station: this.model.toJSON()
        };
    },

    events: {
        'click .add-preset': function(evt) {
            var station = this.model;
            var target = $(evt.target);
            var preset = app.commandPresetsByName[target.data('preset-name')];
            app.Actions.disable();
            station.appendCommandByPreset(preset);
            app.Actions.enable();
            app.vent.trigger('change:plan');
        }
    },

    getRelevantPresets: function() {
        var presets;
        // Lists of command types that pertain to Stations and Segments are available in
        // planSchema.StationSequenceCommands and planSchema.SegmentSequenceCommands, respectively
        var relevantCommandTypes = app.planSchema[this.model.get('type').toLowerCase() + 'SequenceCommands'];
        if (_.isUndefined(relevantCommandTypes)) {
            presets = app.planLibrary.commands;
        } else {
            presets = _.filter(app.planLibrary.commands, function(command) { return _.contains(relevantCommandTypes, command.type)});
        }
        // add timing info in HMS format
        _.each(presets, function(command) {
            if (_.has(command, 'duration')) {
                command.timing = app.util.secondsToHMS(command.duration);
            }
        });
        return presets;
    }
});


app.views.TabNavView = Backbone.Marionette.LayoutView.extend({
    template: '#template-tabnav',
    serializeData: function() {
        data = new Array();
        data.schedule = app.options.schedule;
        return data;
    },
    regions: {
        tabTarget: '#tab-target',
        tabContent: '#tab-content'
    },
    events: {
        'click ul.tab-nav li': 'clickSelectTab'
    },
    viewMap: {
        'meta': app.views.PropertiesForm,
        'sequence': app.views.PlanSequenceView,
        'layers': app.views.FancyTreeView,
        'search': app.views.SearchView,
        'tools': app.views.PlanToolsView,
        'links': app.views.PlanLinksView,
        'schedule': app.views.ScheduleView
    },

    initialize: function() {
        this.on('tabSelected', this.setTab);
        this.listenTo(app.vent, 'setTabRequested', function(tabId) {
            this.setTab(tabId);
        });
        this.layersView = null;
        var context = this;
        $('#tabs-gridstack-item').on('resizestop', function(event, ui) {
        	setTimeout(function(){
        		context.handleGridstackResize();
        	}, 105);
        });
    },

    handleGridstackResize: function() {
    	if (!_.isUndefined(app.State.tabsContainer)){
    		var tabsDiv = this.$el.parent();
    		var grandpa = this.$el.parent().parent();
    		tabsDiv.width(grandpa.width());
//            app.State.tabsContainer.width(app.State.pageInnerWidth -
//                                          app.map.$el.outerWidth() -
//                                          app.State.tabsLeftMargin);
        }
    },
    
    onRender: function() {
        if (! this.options.initialTab) {
            this.options.initialTab = 'meta';
        }
        if (!_.isUndefined(app.currentTab)) {
            this.trigger('tabSelected', app.currentTab);
        } else {
            this.trigger('tabSelected', this.options.initialTab);
        }
    },

    clickSelectTab: function(event) {
        var newmode = $(event.target).parents('li').data('target');
        this.trigger('tabSelected', newmode);
    },

    setTab: function(tabId) {
        var oldTab = app.currentTab;
        app.currentTab = tabId;
        if (oldTab == tabId){
            return;
        }
        var $tabList = this.$el.find('ul.tab-nav li');
        $tabList.each(function() {
            li = $(this);
            if (li.data('target') === tabId) {
                li.addClass('active');
            } else {
                li.removeClass('active');
            }
        });
        var viewClass = this.viewMap[tabId];
        if (! viewClass) { return undefined; }
        var view = new viewClass({
            model: app.currentPlan
        });
        if (oldTab == 'layers'){
            this.tabContent.show(view, {preventClose: true});
        } else {
            if (tabId == 'layers'){
                if (!_.isNull(this.layersView)){
                    this.tabContent.show(this.layersView);
                } else {
                    this.layersView = view;
                    this.tabContent.show(view);
                }
            } else {
                this.tabContent.show(view);
            }
        }
        
        app.vent.trigger('tab:change', tabId);
    }

});

app.views.PlanPlotView = Backbone.Marionette.ItemView.extend({
	el: '#plot-container',
	template: false,
	plotLabels : {},
	plotOptions: { 
        series: {
			lines: { show: true },
			points: { show: false }
		},
		clickable: true,
        grid: {
        	backgroundColor: '#FFFFFF',
            hoverable: true,
            clickable: true,
            autoHighlight: true,
            margin: {
                top: 5,
                left: 0,
                bottom: 5,
                right: 0
            },
            axisMargin: 0,
            borderWidth: 1,
            borderColor: '#C0C0C0'
        },
        shadowSize: 0,
        zoom: {
            interactive: true
        },
        pan: {
            interactive: true
        },
        axisLabels: {
            show: false
        },
        yaxis: {
            max: 5, // set a manual maximum to allow for labels
            ticks: 0 // this line removes the y ticks
        },
    },
    getTickSize: function(durationSeconds) {
    	if (durationSeconds > 12){
    		var twelfth = moment.duration(durationSeconds/12, 'seconds');
    		var m_12 = twelfth.minutes();
    		var h_12 = twelfth.hours();
    		var d_12 = twelfth.days();
    		if (d_12 > 0){
    			return [d_12, 'day'];
    		} else if (h_12 > 0){
    			if (m_12 > 30) {
    				h_12++;
    			}
    			return [h_12, 'hour'];
    		} else if (m_12 > 0) {
    			if (twelfth.seconds() > 30) {
    				m_12++;
    			}
    			return [m_12, 'minute'];
    		}
    	}
    	return [1, 'minute'];
    		
    },
    getXAxisOptions: function() {
    	var durationSeconds = app.currentPlan._simInfo.deltaTimeSeconds;
    	var mduration = moment.duration(durationSeconds, 'seconds');
    	var tickSize = this.getTickSize(durationSeconds);
    	var timeformat = "%H:%M";
    	if (tickSize[1] == 'day'){
    		timeformat = "%m/%d";
    	} else if (mduration.hours() > 12){
    		timeformat = "%m/%d %H:%M";
    	}
    	return { mode: "time",
			  	tickSize: tickSize,
			  	timeformat: timeformat,
			  	timezone: app.getTimeZone(),
			  	reserveSpace: false
				 };
    },
	initialize: function() {
		var context = this;
		this.plotOptions['grid']['markings'] = context.getStationMarkings;
		this.plotOptions['xaxis'] = context.getXAxisOptions(); 
		this.listenTo(app.vent, 'updatePlanDuration', function(model) {this.render()});
		app.currentPlan.get('sequence').on('remove', function(model){this.render()}, this);
		$('#plot-container').resize(function() {
			context.drawStationLabels();
		});
	},
	
    getStationMarkings: function() {
    	if (app.currentPlan._simInfo === undefined){
    		app.simulatePlan();
    	}
    	var result = [];
    	this.startEndTimes = app.getStationStartEndTimes();
    	for (var i=0; i<startEndTimes.length; i++){
    		result.push({xaxis: {from:this.startEndTimes[i].start.toDate().getTime(),
    							 to: this.startEndTimes[i].end.toDate().getTime()},
    							 color:'#FFA500'});
    	}
    	return result;
    },
    drawStationLabels: function(startEndTimes) {
    	// draw labels
    	if (startEndTimes === undefined){
    		startEndTimes = this.startEndTimes;
    	}
		var context = this;
		var index = 0;
		var sequence = app.currentPlan.get('sequence');
		var saveUs = [];
		var deathRow = []
		sequence.each(function(pathElement, i, sequence) {
    		if (pathElement.attributes.type == 'Station'){
    			startEndTime = startEndTimes[index];
    			o = context.plot.pointOffset({ x: startEndTime.start.toDate().getTime(), y: 0 });
    			if (pathElement.attributes.uuid in context.plotLabels){
    				context.plotLabels[pathElement.attributes.uuid].text(pathElement._sequenceLabel);
    				context.plotLabels[pathElement.attributes.uuid].css({top: (o.top - 20), left: (o.left + 4), position:'absolute'});
    			} else {
    				var el = $("<div id='plotLabel_" + pathElement.attributes.uuid + "' style='position:absolute;left:" + (o.left + 4) + "px;top:" + (o.top - 20) + "px;color:#FF4500;font-size:smaller;font-weight:bold;'>" + pathElement._sequenceLabel + "</div>");
    				el.appendTo(plotDiv);
    				context.plotLabels[pathElement.attributes.uuid] = el;
    			}
        		saveUs.push(pathElement.attributes.uuid);
    			index++;
    		}
		});
//		_.each(Object.keys(context.plotLabels), function(key){
//			if (saveUs.indexOf(key) < 0){
//				deathRow.push(key);
//			}
//		});
//		_.each(deathRow, function(key){
//			context.plotLabels[key].remove();
//			delete context.plotLabels[key];
//		});
    },
	onRender: function() {
		var stationData = [];
    	this.startEndTimes = app.getStationStartEndTimes();
    	if (_.isEmpty(this.startEndTimes)){
    		return;
    	}

    	for (var i=0; i<this.startEndTimes.length; i++){
    		stationData.push([this.startEndTimes[i].start.toDate().getTime(), 0]);
    		stationData.push([this.startEndTimes[i].end.toDate().getTime(), 0]);
    		stationData.push(null);
    	}
		
    	var plotDiv = this.$el.find("#plotDiv");
    	if (this.plot == undefined) {
    		this.plot = $.plot(plotDiv, [stationData], this.plotOptions);
    		this.drawStationLabels(this.startEndTimes);
    	} else {
    		this.plot.setupGrid();
    		this.plot.setData([stationData]);
    	    this.plot.draw();
    		this.drawStationLabels(this.startEndTimes);
    	}
		 
	}
});
