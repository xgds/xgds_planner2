# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.test import TestCase
from django.test.utils import override_settings
from django.core.urlresolvers import reverse

from xgds_planner2 import models

import logging


@override_settings(PIPELINE_ENABLED=False)
class xgds_planner2Test(TestCase):
    fixtures = ['xgds_planner2_testing.json',
                'xgds_planner2_testing_auth.json',
                ]
    #urls = "xgds_planner2.testing_urls"

    def setUp(self):
        logging.disable(logging.WARNING)
        self.test_plan_data = {"planNumber": 1,
                               "planVersion": "A",
                               "platform": "Diver"}

    def test_index(self):
        response = self.client.get(reverse('planner2_index'))
        self.assertEquals(response.status_code, 200)

    def test_edit(self):
        response = self.client.get(reverse('planner2_edit', args=['1']))
        self.assertEquals(response.status_code, 200)

    def test_doc(self):
        response = self.client.get(reverse('planner2_doc', args=['1']))
        self.assertEquals(response.status_code, 200)

    def test_plan_REST(self):
        response = self.client.get(reverse('planner2_planREST', args=['1', 'test']))
        self.assertEquals(response.status_code, 200)

    def test_plan_export(self):
        response = self.client.get(reverse('planner2_planExport',
                                           args=['421d0eb5-f04d-4f36-a4f7-503e0ca8ef2e', 'test.kml']),
                                   follow=True)
        self.assertEquals(response.status_code, 200)

    def test_create_plan_page(self):
        self.client.login(username="vagrant", password="vagrant")
        response = self.client.get(reverse('planner2_planCreate'))
        self.assertEquals(response.status_code, 200)

    def test_create_plan(self):
        # Note: this test conflicts with plrp, so disabled.
        if 0:
            self.client.login(username="vagrant", password="vagrant")
            response = self.client.post(reverse('planner2_planCreate'), self.test_plan_data)
            self.assertEqual(response.status_code, 302)
            self.assertEqual(len(models.Plan.objects.all()), 2)
