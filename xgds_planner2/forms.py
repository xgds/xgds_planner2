# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django import forms

from xgds_planner2 import xpjson, models

SITE_CHOICES = [(x.id, x.name) for x in models.LIBRARY.sites]
PLATFORM_CHOICES = [(x.id, x.name) for x in models.LIBRARY.platforms]


class CreatePlanForm(forms.Form):
    planNumber = forms.IntegerField(initial=9999)
    planVersion = forms.CharField(max_length=1, initial='A')
    site = forms.ChoiceField(choices=SITE_CHOICES, required=False)
    platform = forms.ChoiceField(choices=PLATFORM_CHOICES, required=False)
