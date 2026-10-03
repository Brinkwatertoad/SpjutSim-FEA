SetFactory("OpenCASCADE");
Geometry.OCCTargetUnit="M";
Geometry.OCCUnionUnify=0;
Cylinder(1)={0,0,0,0,0,1,.5,Pi};
Cylinder(2)={0,0,0,0,0,1,.5,Pi};
Rotate {{0,0,1},{0,0,0},Pi} { Volume{2}; }
BooleanUnion{Volume{1};Delete;}{Volume{2};Delete;}
