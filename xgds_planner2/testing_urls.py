from django.conf.urls import url, patterns, include

urlpatterns = patterns(
    '',

    (r'^xgds_planner2/', include('xgds_planner2.urls')),
)
