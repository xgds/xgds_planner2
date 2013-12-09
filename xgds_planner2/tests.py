# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.test import TestCase
from django.contrib.auth.models import User
from django.test.utils import override_settings

from xgds_planner2 import settings

import logging

@override_settings(XGDS_PLANNER2_PLAN_MODEL="xgds_planner2.Plan", PIPELINE_ENABLED=False)
class xgds_planner2Test(TestCase):
    fixtures = ['xgds_planner2_testing.json',
                'xgds_planner2_testing_auth.json']
    urls = 'xgds_planner2.testing_urls'

    def setUp(self):
        logging.disable(logging.WARNING)

    def test_index(self):
        response = self.client.get('/xgds_planner2/index/', follow=True)
        self.assertEquals(response.status_code, 200)

    def test_edit(self):
        response = self.client.get('/xgds_planner2/edit/1', follow=True)
        self.assertEquals(response.status_code, 200)

    def test_doc(self):
        response = self.client.get('/xgds_planner2/doc/1', follow=True)
        self.assertEquals(response.status_code, 200)

    def test_plan_REST(self):
        response = self.client.get('/xgds_planner2/plan/1/test.json', follow=True)
        self.assertEquals(response.status_code, 200)

    def test_plan_export(self):
        response = self.client.get('/xgds_planner2/plan/export/421d0eb5-f04d-4f36-a4f7-503e0ca8ef2e/test.kml', follow=True)
        self.assertEquals(response.status_code, 200)

    def test_create_plan(self):
        self.client.login(username="vagrant", password="vagrant")
        response = self.client.get('/xgds_planner2/plan/create/', follow=True)
        self.assertEquals(response.status_code, 200)
