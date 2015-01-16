/* Scan for macro calls in a string */
//---------------------------------------
/*include(Copyright)*/

#include <stdlib.h>
#include <tcl.h>
#include <malloc.h>
#include <string.h>

#define STRLEN	256

/* Scan a string for a macro call of the form: macroname(.*)
   Return a list of three items:
     1. All characters before the macro call
     2. The string (parameters) inside the parenthesis
     3. All characters after the macro call
   The parameters inside the parenthesis can contain other parentheses as
   long as they are properly matched (left and right). */
int macscan(ClientData clientData, Tcl_Interp *interp, int objc, Tcl_Obj *CONST objv[])
	{
	int lev, slen;
	char *name;								/* name of macro to scan for */
	char *code;								/* string of code to analyze */
	char *s, *t;							/* temporary string pointers */
	Tcl_Obj *robv[3];						/* object to return (list) */
	char *pre = "", *parm = "", *post = "";	/* list elements to return (before macro, macro parameters, after macro) */
	char tmpstrg[STRLEN];

    if (objc < 3 || objc > 3) {
        Tcl_WrongNumArgs(interp, 1, objv, "macscan macro_name code_string");
        return TCL_ERROR;
    }

    name = Tcl_GetStringFromObj(objv[1], &slen);
    if (slen <= 0) {
        Tcl_AddErrorInfo(interp, "macscan: Invalid (blank) macro name");
        return TCL_ERROR;
    }

    code = Tcl_GetStringFromObj(objv[2], &slen);
//fprintf(stderr,"Name: %s\n", name);
//fprintf(stderr,"Code: %s\n", code);

    strcpy(t = malloc(strlen(name)+2), name);	/* make a copy of macro name */
    strcat(t, "(");								/* add opening paren to it: "macname(" */
    s = strstr(code, t);			/* is this macro call in our string? */
    if (s == NULL) {						/* if macro not found */
//fprintf(stderr,"Not found\n");
        Tcl_SetObjResult(interp, Tcl_NewStringObj("",-1));	/* return empty list */
        return TCL_OK;
    }

//fprintf(stderr,"Found macro\n");
    pre = code;
    *s = 0;							/* null terminate pre string */

    parm = (s += strlen(t));		/* move to where parameters start */
    for (lev = 0; 1; s++) {
        if (*s == ')') {			/* found possible end of parameters */
            if (lev <= 0) {			/* yes, this is the end */
                *s++ = 0;			/* null terminate parms, skip over close paren */
                post = s;			/* return balance of string */
                break;
            } else {				/* nope, just a nested parenthesis close */
                lev--;
            }
        } else if(*s == '(') {
            lev++;					/* increase nesting level */
        } else if(*s == 0) {		/* premature end of string */
            snprintf(tmpstrg, STRLEN, "Un-terminated macro: %s following: %s", name, code);
            Tcl_AddErrorInfo(interp, tmpstrg);
            return TCL_ERROR;
        }
    }

    robv[0] = Tcl_NewStringObj(pre,-1);			/* build list to return */
    robv[1] = Tcl_NewStringObj(parm,-1);
    robv[2] = Tcl_NewStringObj(post,-1);
    Tcl_SetObjResult(interp, Tcl_NewListObj(3, robv));
    return TCL_OK;
	}

/* Initialization for this module */
/* ------------------------------------------------------------------------- */
int Macscan_Init(Tcl_Interp *interp) {

//printf("Initing 0\n");
    Tcl_CreateObjCommand(interp,"macscan",	macscan,	(ClientData) NULL, (Tcl_CmdDeleteProc *) NULL);

    return TCL_OK;
    }
