# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms
from xgds_planner2 import models
from django.conf import settings

# pylint: disable=R0924

# SITE_CHOICES = [(x.id, x.name) for x in models.LIBRARY.sites]
# PLATFORM_CHOICES = [(x.id, x.name) for x in models.LIBRARY.platforms]


class CreatePlanForm(forms.Form):
    planNumber = forms.IntegerField(label='Plan number')
    planVersion = forms.CharField(label='Plan version', max_length=1, initial='A')
    platform = forms.ChoiceField(choices=[], required=True)

    #site = forms.ChoiceField(choices=SITE_CHOICES, required=False)
    #platform = forms.ChoiceField(choices=PLATFORM_CHOICES, required=False)

    def __init__(self, *args, **kwargs):
        super(CreatePlanForm, self).__init__(*args, **kwargs)
        platforms = sorted(settings.XGDS_PLANNER_SCHEMAS.keys())
        self.fields['platform'].choices = [(p, p) for p in platforms]
