
RST2HTML=rst2html.py --stylesheet=spec.css
OUTDIR=../../../../build/static/xgds_planner2

all: \
  $(OUTDIR)/xpjson.html

clean:
	rm -rf $(OUTDIR)

#publish: all
#	rsync -rvz build/ mysite.org:mydir

$(OUTDIR)/xpjson.html: xpjson.rst spec.css
	[ -d $(OUTDIR) ] || mkdir -p $(OUTDIR)
	$(RST2HTML) $< $@
