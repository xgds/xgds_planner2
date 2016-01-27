#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

import datetime
from django import forms
from django.conf import settings
from geocamUtil.loader import LazyGetModelByName
from xgds_planner2.models import getPlanSchema


class CreatePlanForm(forms.Form):
    planNumber = forms.IntegerField(label=settings.XGDS_PLANNER2_PLAN_MONIKER + ' number')
    planVersion = forms.CharField(label=settings.XGDS_PLANNER2_PLAN_MONIKER + ' version', max_length=1, initial='A')
    platform = forms.ChoiceField(choices=[], required=True)
    site = forms.ChoiceField(choices=[], required=False, label=settings.XGDS_MAP_SERVER_SITE_MONIKER)

    def __init__(self, *args, **kwargs):
        super(CreatePlanForm, self).__init__(*args, **kwargs)
        platforms = sorted(settings.XGDS_PLANNER_SCHEMAS.keys())
        try:
            platforms.remove("test")
        except ValueError:
            pass
        self.fields['platform'].choices = [(p, p) for p in platforms]

        # TODO right now this shows an alphabetically sorted list of all the sites together.
        # really what we want is to change the sites based on the chosen platform.
        allSites = []
        for platform in platforms:
            schema = getPlanSchema(platform)
            library = schema.getLibrary()
            sites = library.sites
            if sites:
                for site in sites:
                    allSites.append(site)
        sites = sorted(allSites, key=lambda site: site.name)
        self.fields['site'].choices = [(site.id, site.name) for site in sites]


# form for creating a flight group, flights, and all sorts of other stuff needed for our overly complex system.
class GroupFlightForm(forms.Form):
    year = None
    month = None
    day = None
    date = forms.DateField(required=True)
    prefix = forms.CharField(widget=forms.TextInput(attrs={'size': 4}),
                             label="Prefix",
                             required=True,
                             initial='A')

    CHOICES = []
    VEHICLE_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_VEHICLE_MODEL)
    for vehicle in VEHICLE_MODEL.get().objects.all().order_by('name'):
        CHOICES.append((vehicle.name, vehicle.name))

    if len(CHOICES) == 1:
        initial = [c[0] for c in CHOICES]
    else:
        initial = None
    vehicles = forms.MultipleChoiceField(choices=CHOICES, widget=forms.CheckboxSelectMultiple(), required=False, initial=initial)

    notes = forms.CharField(widget=forms.TextInput(attrs={'size': 128}), label="Notes", required=False)
    
    def initialize(self, timeinfo):
        self.year = timeinfo['year']
        self.month = timeinfo['month']
        self.day = timeinfo['day']
        self.date = datetime.date(int(self.year), int(self.month), int(self.day))
        self.month = int(timeinfo['month']) - 1  # apparently 0 is january


class UploadXPJsonForm(forms.Form):
    file = forms.FileField(required=True)
    planUuid = forms.CharField(required=True)