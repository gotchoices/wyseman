/* C functions associated with wyseman */
//---------------------------------------
/*include(Copyright)*/

#include <tcl.h>
#include "../Version.h"

extern int Wyseman_Init(Tcl_Interp *interp);	/* run when library loaded */

/* Initialization for this module */
/* ------------------------------------------------------------------------- */
int Wyseman_Init(Tcl_Interp *interp) {
    register int r;

// Example for if we add other modules:
//    r = Checkline_Init(interp);
//    if (r != TCL_OK) {return TCL_ERROR;}
    
    r = Macscan_Init(interp);
    if (r != TCL_OK) {return TCL_ERROR;}
    
    Tcl_PkgProvide(interp,PACKAGE,VERSION);
    return TCL_OK;
    }
