.PHONY: validate test package source install uninstall

validate:
	bash scripts/validate.sh

test:
	node --test tests/*.test.js

package:
	bash scripts/package.sh

source:
	bash scripts/package-source.sh

install:
	bash scripts/install.sh

uninstall:
	bash scripts/uninstall.sh
