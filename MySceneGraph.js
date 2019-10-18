var DEGREE_TO_RAD = Math.PI / 180;

// Order of the groups in the XML document.
var SCENE_INDEX = 0;
var VIEWS_INDEX = 1;
var GLOBALS_INDEX = 2;
var LIGHTS_INDEX = 3;
var TEXTURES_INDEX = 4;
var MATERIALS_INDEX = 5;
var TRANSFORMATIONS_INDEX = 6;
var PRIMITIVES_INDEX = 7;
var COMPONENTS_INDEX = 8;

/**
 * MySceneGraph class, representing the scene graph.
 */
class MySceneGraph {
    /**
     * @constructor
     */
    constructor(filename, scene) {
        this.count = 0;
        this.loadedOk = null;

        // Establish bidirectional references between scene and graph.
        this.scene = scene;
        scene.graph = this;

        this.nodes = [];

        this.idRoot = null;                    // The id of the root element.

        this.axisCoords = [];
        this.axisCoords['x'] = [1, 0, 0];
        this.axisCoords['y'] = [0, 1, 0];
        this.axisCoords['z'] = [0, 0, 1];

        // File reading 
        this.reader = new CGFXMLreader();

        /*
         * Read the contents of the xml file, and refer to this class for loading and error handlers.
         * After the file is read, the reader calls onXMLReady on this object.
         * If any error occurs, the reader calls onXMLError on this object, with an error message
         */
        this.reader.open('scenes/' + filename, this);

        this.key_presses = 0;
    }

    /*
     * Callback to be executed after successful reading
     */
    onXMLReady() {
        this.log("XML Loading finished.");
        var rootElement = this.reader.xmlDoc.documentElement;

        // Here should go the calls for different functions to parse the various blocks
        var error = this.parseXMLFile(rootElement);

        if (error != null) {
            this.onXMLError(error);
            return;
        }

        this.loadedOk = true;

        // As the graph loaded ok, signal the scene so that any additional initialization depending on the graph can take place
        this.scene.onGraphLoaded();
    }

    /**
     * Parses the XML file, processing each block.
     * @param {XML root element} rootElement
     */
    parseXMLFile(rootElement) {
        if (rootElement.nodeName != "lxs")
            return "root tag <lxs> missing";

        var nodes = rootElement.children;

        // Reads the names of the nodes to an auxiliary buffer.
        var nodeNames = [];

        for (var i = 0; i < nodes.length; i++) {
            nodeNames.push(nodes[i].nodeName);
        }

        var error;

        // Processes each node, verifying errors.

        // <scene>
        var index;
        if ((index = nodeNames.indexOf("scene")) == -1)
            return "tag <scene> missing";
        else {
            if (index != SCENE_INDEX)
                this.onXMLMinorError("tag <scene> out of order " + index);

            //Parse scene block
            if ((error = this.parseScene(nodes[index])) != null)
                return error;
        }

        // <views>
        if ((index = nodeNames.indexOf("views")) == -1)
            return "tag <views> missing";
        else {
            if (index != VIEWS_INDEX)
                this.onXMLMinorError("tag <views> out of order");

            //Parse views block
            if ((error = this.parseView(nodes[index])) != null)
                return error;
        }

        // <ambient>
        if ((index = nodeNames.indexOf("globals")) == -1)
            return "tag <globals> missing";
        else {
            if (index != GLOBALS_INDEX)
                this.onXMLMinorError("tag <globals> out of order");

            //Parse ambient block
            if ((error = this.parseAmbient(nodes[index])) != null)
                return error;
        }

        // <lights>
        if ((index = nodeNames.indexOf("lights")) == -1)
            return "tag <lights> missing";
        else {
            if (index != LIGHTS_INDEX)
                this.onXMLMinorError("tag <lights> out of order");

            //Parse lights block
            if ((error = this.parseLights(nodes[index])) != null)
                return error;
        }
        // <textures>
        if ((index = nodeNames.indexOf("textures")) == -1)
            return "tag <textures> missing";
        else {
            if (index != TEXTURES_INDEX)
                this.onXMLMinorError("tag <textures> out of order");

            //Parse textures block
            if ((error = this.parseTextures(nodes[index])) != null)
                return error;
        }

        // <materials>
        if ((index = nodeNames.indexOf("materials")) == -1)
            return "tag <materials> missing";
        else {
            if (index != MATERIALS_INDEX)
                this.onXMLMinorError("tag <materials> out of order");

            //Parse materials block
            if ((error = this.parseMaterials(nodes[index])) != null)
                return error;
        }

        // <transformations>
        if ((index = nodeNames.indexOf("transformations")) == -1)
            return "tag <transformations> missing";
        else {
            if (index != TRANSFORMATIONS_INDEX)
                this.onXMLMinorError("tag <transformations> out of order");

            //Parse transformations block
            if ((error = this.parseTransformations(nodes[index])) != null)
                return error;
        }

        // <primitives>
        if ((index = nodeNames.indexOf("primitives")) == -1)
            return "tag <primitives> missing";
        else {
            if (index != PRIMITIVES_INDEX)
                this.onXMLMinorError("tag <primitives> out of order");

            //Parse primitives block
            if ((error = this.parsePrimitives(nodes[index])) != null)
                return error;
        }

        // <components>
        if ((index = nodeNames.indexOf("components")) == -1)
            return "tag <components> missing";
        else {
            if (index != COMPONENTS_INDEX)
                this.onXMLMinorError("tag <components> out of order");

            //Parse components block
            if ((error = this.parseComponents(nodes[index])) != null)
                return error;
        }
        this.log("all parsed");
    }

    /**
     * Parses the <scene> block. 
     * @param {scene block element} sceneNode
     */
    parseScene(sceneNode) {

        // Get root of the scene.
        var root = this.reader.getString(sceneNode, 'root')
        if (root == null)
            return "no root defined for scene";

        this.idRoot = root;

        // Get axis length        
        var axis_length = this.reader.getFloat(sceneNode, 'axis_length');
        if (axis_length == null)
            this.onXMLMinorError("no axis_length defined for scene; assuming 'length = 1'");

        this.referenceLength = axis_length || 1;

        this.log("Parsed scene");

        return null;
    }

    /**
     * Parses the <views> block.
     * @param {view block element} viewsNode
     */
    parseView(viewsNode) {

        var children = viewsNode.children;

        this.cameras = [];

        var grandChildren = [];
        var nodeNames = [];

        // Any number of cameras.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "perspective" && children[i].nodeName != "ortho") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current cameraID.
            var cameraID = this.reader.getString(children[i], 'id');
            if (cameraID == null)
                return "no ID defined for camera";

            // Checks for repeated IDs.
            if (this.cameras[cameraID] != null)
                return "ID must be unique for each camera (conflict: ID = " + cameraID + ")";


            // this.cameras[materialID] = new CGFappearance(this.scene);

            var near = this.reader.getFloat(children[i], 'near');
            if (near == null)
                return "no near defined for camera (conflict: ID = " + cameraID + ")";

            if (!(near != null && !isNaN(near)))
                return "unable to parse near of camera with ID = " + cameraID;

            
            var far = this.reader.getFloat(children[i], 'far');
            if (far == null)
                return "no far defined for camera (conflict: ID = " + cameraID + ")";

            if (!(far != null && !isNaN(far)))
                return "unable to parse far of camera with ID = " + cameraID;

            var angle = null;
            var left = null;
            var right = null;
            var top = null;
            var bottom = null;


            if (children[i].nodeName == 'perspective'){

                var angle = this.reader.getFloat(children[i], 'angle');
                if (angle == null)
                    return "no angle defined for camera (conflict: ID = " + cameraID + ")";

                if (!(angle != null && !isNaN(angle)))
                    return "unable to parse angle of camera with ID = " + cameraID;

            } else if (children[i].nodeName == 'ortho') {

                left = this.reader.getFloat(children[i], 'left');
                if (left == null)
                    return "no left defined for camera (conflict: ID = " + cameraID + ")";

                if (!(left != null && !isNaN(left)))
                    return "unable to parse left of camera with ID = " + cameraID;


                right = this.reader.getFloat(children[i], 'right');
                if (right == null)
                    return "no right defined for camera (conflict: ID = " + cameraID + ")";

                if (!(right != null && !isNaN(right)))
                    return "unable to parse right of camera with ID = " + cameraID;


                top = this.reader.getFloat(children[i], 'top');
                if (top == null)
                    return "no top defined for camera (conflict: ID = " + cameraID + ")";

                if (!(top != null && !isNaN(top)))
                    return "unable to parse top of camera with ID = " + cameraID;


                bottom = this.reader.getFloat(children[i], 'bottom');
                if (bottom == null)
                    return "no bottom defined for camera (conflict: ID = " + cameraID + ")";

                if (!(bottom != null && !isNaN(bottom)))
                    return "unable to parse bottom of camera with ID = " + cameraID;

            }

            grandChildren = children[i].children;

            var updated = [];

            var from = null;
            var to = null;
            var up = null;

            for (var j = 0; j < grandChildren.length; j++) {

                if (updated[grandChildren[j].nodeName] != null)
                    return "tag <" + grandChildren[j].nodeName + "> must be unique for each camera (conflict: ID = " + cameraID + ")";

                if (grandChildren[j].nodeName == "from") {

                    from = this.parseCoordinates3D(grandChildren[j], "camera 'from' position for ID = " + cameraID);

                    if (!Array.isArray(from))
                            return from;


                } else if (grandChildren[j].nodeName == "to") {

                    to = this.parseCoordinates3D(grandChildren[j], "camera 'to' position for ID = " + cameraID);

                    if (!Array.isArray(to))
                            return to;

                } else if (grandChildren[j].nodeName == "up") {

                    if (children[i].nodeName == 'perspective')
                        return "perspective camera can't receive 'up' parameter in camera with ID = " + cameraID;

                    up = this.parseCoordinates3D(grandChildren[j], "camera 'up' position for ID = " + cameraID);

                    if (!Array.isArray(up))
                            return up;

                } else {
                    return "tag <" + grandChildren[j].nodeName + "> not recognized for camera (conflict: ID = " + cameraID + ")";
                }

                updated[grandChildren[j].nodeName] = 1;
            }

            if (children[i].nodeName == "perspective"){
                if (from == null || to == null || angle == null)
                    return "missing atributes for camera with ID = " + cameraID;

                this.cameras[cameraID] = new CGFcamera(angle/180, near, far, from, to);

            } else if (children[i].nodeName == "ortho"){
                if (left == null || right == null || bottom == null || top == null || from == null || to == null)
                    return "missing atributes for camera with ID = " + cameraID;

                if (up == null)
                    up.push(0,1,0);
                
                this.cameras[cameraID] = new CGFcameraOrtho(left, right, bottom, top, near, far, from, to, up)
            }
        }

        this.log("Parsed cameras");
        return null;
    }

    /**
     * Parses the <ambient> node.
     * @param {ambient block element} ambientsNode
     */
    parseAmbient(ambientsNode) {

        var children = ambientsNode.children;

        this.ambient = [];
        this.background = [];

        var nodeNames = [];

        for (var i = 0; i < children.length; i++)
            nodeNames.push(children[i].nodeName);

        var ambientIndex = nodeNames.indexOf("ambient");
        var backgroundIndex = nodeNames.indexOf("background");

        var color = this.parseColor(children[ambientIndex], "ambient");
        if (!Array.isArray(color))
            return color;
        else
            this.ambient = color;

        color = this.parseColor(children[backgroundIndex], "background");
        if (!Array.isArray(color))
            return color;
        else
            this.background = color;

        this.log("Parsed ambient");

        return null;
    }

    /**
     * Parses the <light> node.
     * @param {lights block element} lightsNode
     */
    parseLights(lightsNode) {
        var children = lightsNode.children;

        this.lights = [];
        var numLights = 0;

        var grandChildren = [];
        var nodeNames = [];

        // Any number of lights.
        for (var i = 0; i < children.length; i++) {

            // Storing light information
            var global = [];
            var attributeNames = [];
            var attributeTypes = [];

            //Check type of light
            if (children[i].nodeName != "omni" && children[i].nodeName != "spot") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }
            else {
                attributeNames.push(...["location", "ambient", "diffuse", "specular"]);
                attributeTypes.push(...["position", "color", "color", "color"]);
            }

            // Get id of the current light.
            var lightId = this.reader.getString(children[i], 'id');
            if (lightId == null)
                return "no ID defined for light";

            // Checks for repeated IDs.
            if (this.lights[lightId] != null)
                return "ID must be unique for each light (conflict: ID = " + lightId + ")";

            // Light enable/disable
            var enableLight = true;
            var aux = this.reader.getBoolean(children[i], 'enabled');
            if (!(aux != null && !isNaN(aux) && (aux == true || aux == false)))
                this.onXMLMinorError("unable to parse value component of the 'enable light' field for ID = " + lightId + "; assuming 'value = 1'");

            enableLight = aux;

            //Add enabled boolean and type name to light info
            global.push(enableLight);
            global.push(children[i].nodeName);

            grandChildren = children[i].children;
            // Specifications for the current light.

            nodeNames = [];
            for (var j = 0; j < grandChildren.length; j++) {
                nodeNames.push(grandChildren[j].nodeName);
            }

            for (var j = 0; j < attributeNames.length; j++) {
                var attributeIndex = nodeNames.indexOf(attributeNames[j]);

                if (attributeIndex != -1) {
                    if (attributeTypes[j] == "position")
                        var aux = this.parseCoordinates4D(grandChildren[attributeIndex], "light position for ID" + lightId);
                    else
                        var aux = this.parseColor(grandChildren[attributeIndex], attributeNames[j] + " illumination for ID" + lightId);

                    if (!Array.isArray(aux))
                        return aux;

                    global.push(aux);
                }
                else
                    return "light " + attributeNames[i] + " undefined for ID = " + lightId;
            }

            // Gets the additional attributes of the spot light
            if (children[i].nodeName == "spot") {
                var angle = this.reader.getFloat(children[i], 'angle');
                if (!(angle != null && !isNaN(angle)))
                    return "unable to parse angle of the light for ID = " + lightId;

                var exponent = this.reader.getFloat(children[i], 'exponent');
                if (!(exponent != null && !isNaN(exponent)))
                    return "unable to parse exponent of the light for ID = " + lightId;

                var targetIndex = nodeNames.indexOf("target");

                // Retrieves the light target.
                var targetLight = [];
                if (targetIndex != -1) {
                    var aux = this.parseCoordinates3D(grandChildren[targetIndex], "target light for ID " + lightId);
                    if (!Array.isArray(aux))
                        return aux;

                    targetLight = aux;
                }
                else
                    return "light target undefined for ID = " + lightId;

                global.push(...[angle, exponent, targetLight])
            }

            this.lights[lightId] = global;
            numLights++;

        }

        if (numLights == 0)
            return "at least one light must be defined";
        else if (numLights > 8)
            this.onXMLMinorError("too many lights defined; WebGL imposes a limit of 8 lights");

        this.log("Parsed lights");
        return null;
    }
    
    /**
     * Parses the <textures> block. 
     * @param {textures block element} texturesNode
     */
    parseTextures(texturesNode) {
        var children = texturesNode.children;

        this.textures = [];

        var nodeNames = [];


        // Any number of textures.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "texture") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current texture.
            var textureID = this.reader.getString(children[i], 'id');
            if (textureID == null)
                return "no ID defined for texture";

            // Checks for repeated IDs.
            if (this.textures[textureID] != null)
                return "ID must be unique for each texture (conflict: ID = " + textureID + ")";


            // Get file of the current texture.
            var textureFile = this.reader.getString(children[i], 'file');
            if (textureFile == null)
                return "no file defined for texture (conflict: ID = " + textureID + ")";

            var texture = new CGFtexture(this.scene, textureFile);

            this.textures[textureID] = texture;
            console.log(this.textures);
            // this.textures[textureID].loadTexture(textureFile);
            // this.textures[textureID].setTextureWrap('REPEAT', 'REPEAT');

        }

        this.log("Parsed textures");
        return null;
    }

    /**
     * Parses the <materials> node.
     * @param {materials block element} materialsNode
     */
    parseMaterials(materialsNode) {
        var children = materialsNode.children;

        this.materials = [];

        var grandChildren = [];
        var nodeNames = [];

        // Any number of materials.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "material") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current material.
            var materialID = this.reader.getString(children[i], 'id');
            if (materialID == null)
                return "no ID defined for material";

            // Checks for repeated IDs.
            if (this.materials[materialID] != null)
                return "ID must be unique for each material (conflict: ID = " + materialID + ")";


            this.materials[materialID] = new CGFappearance(this.scene);

            // Default values
            this.materials[materialID].setAmbient(0, 0, 0, 0);
            this.materials[materialID].setDiffuse(0, 0, 0, 0);
            this.materials[materialID].setSpecular(0, 0, 0, 0);
            this.materials[materialID].setShininess(0);

            var shininess = this.reader.getString(children[i], 'shininess');
            if (shininess == null)
                return "no shininess defined for material (conflict: ID = " + materialID + ")";

            if (!(shininess != null && !isNaN(shininess)))
                return "unable to parse shininess of material with ID = " + materialID;

            this.materials[materialID].setShininess(shininess);

            grandChildren = children[i].children;

            var updated = [];

            for (var j = 0; j < grandChildren.length; j++) {

                if (updated[grandChildren[j].nodeName] != null)
                    return "tag <" + grandChildren[j].nodeName + "> must be unique for each material (conflict: ID = " + materialID + ")";

                if (grandChildren[j].nodeName == "emission") {

                    var r = this.reader.getFloat(grandChildren[j], 'r');
                    if (!(r != null && !isNaN(r) && r >= 0.0 && r <= 1.0))
                        return "unable to parse r of emission property of the material with ID = " + materialID;

                    var g = this.reader.getFloat(grandChildren[j], 'g');
                    if (!(g != null && !isNaN(g) && g >= 0.0 && g <= 1.0))
                        return "unable to parse g of emission property of the material with ID = " + materialID;

                    var b = this.reader.getFloat(grandChildren[j], 'b');
                    if (!(b != null && !isNaN(b) && b >= 0.0 && b <= 1.0))
                        return "unable to parse b of emission property of the material with ID = " + materialID;

                    var a = this.reader.getFloat(grandChildren[j], 'a');
                    if (!(a != null && !isNaN(a) && a >= 0.0 && a <= 1.0))
                        return "unable to parse a of emission property of the material with ID = " + materialID;

                    this.materials[materialID].setEmission(r, g, b, a);

                } else if (grandChildren[j].nodeName == "ambient") {

                    var r = this.reader.getFloat(grandChildren[j], 'r');
                    if (!(r != null && !isNaN(r) && r >= 0.0 && r <= 1.0))
                        return "unable to parse r of ambient property of the material with ID = " + materialID;

                    var g = this.reader.getFloat(grandChildren[j], 'g');
                    if (!(g != null && !isNaN(g) && g >= 0.0 && g <= 1.0))
                        return "unable to parse g of ambient property of the material with ID = " + materialID;

                    var b = this.reader.getFloat(grandChildren[j], 'b');
                    if (!(b != null && !isNaN(b) && b >= 0.0 && b <= 1.0))
                        return "unable to parse b of ambient property of the material with ID = " + materialID;

                    var a = this.reader.getFloat(grandChildren[j], 'a');
                    if (!(a != null && !isNaN(a) && a >= 0.0 && a <= 1.0))
                        return "unable to parse a of ambient property of the material with ID = " + materialID;

                    this.materials[materialID].setAmbient(r, g, b, a);

                } else if (grandChildren[j].nodeName == "diffuse") {

                    var r = this.reader.getFloat(grandChildren[j], 'r');
                    if (!(r != null && !isNaN(r) && r >= 0.0 && r <= 1.0))
                        return "unable to parse r of diffuse property of the material with ID = " + materialID;

                    var g = this.reader.getFloat(grandChildren[j], 'g');
                    if (!(g != null && !isNaN(g) && g >= 0.0 && g <= 1.0))
                        return "unable to parse g of diffuse property of the material with ID = " + materialID;

                    var b = this.reader.getFloat(grandChildren[j], 'b');
                    if (!(b != null && !isNaN(b) && b >= 0.0 && b <= 1.0))
                        return "unable to parse b of diffuse property of the material with ID = " + materialID;

                    var a = this.reader.getFloat(grandChildren[j], 'a');
                    if (!(a != null && !isNaN(a) && a >= 0.0 && a <= 1.0))
                        return "unable to parse a of diffuse property of the material with ID = " + materialID;

                    this.materials[materialID].setDiffuse(r, g, b, a);

                } else if (grandChildren[j].nodeName == "specular") {

                    var r = this.reader.getFloat(grandChildren[j], 'r');
                    if (!(r != null && !isNaN(r) && r >= 0.0 && r <= 1.0))
                        return "unable to parse r of specular property of the material with ID = " + materialID;

                    var g = this.reader.getFloat(grandChildren[j], 'g');
                    if (!(g != null && !isNaN(g) && g >= 0.0 && g <= 1.0))
                        return "unable to parse g of specular property of the material with ID = " + materialID;

                    var b = this.reader.getFloat(grandChildren[j], 'b');
                    if (!(b != null && !isNaN(b) && b >= 0.0 && b <= 1.0))
                        return "unable to parse b of specular property of the material with ID = " + materialID;

                    var a = this.reader.getFloat(grandChildren[j], 'a');
                    if (!(a != null && !isNaN(a) && a >= 0.0 && a <= 1.0))
                        return "unable to parse a of specular property of the material with ID = " + materialID;

                    this.materials[materialID].setSpecular(r, g, b, a);

                } else {
                    return "tag <" + grandChildren[j].nodeName + "> not recognized for material (conflict: ID = " + materialID + ")";
                }

                updated[grandChildren[j].nodeName] = 1;
            }

        }

        this.log("Parsed materials");
        return null;
    }

    /**
     * Parses the <transformations> block.
     * @param {transformations block element} transformationsNode
     */
    parseTransformations(transformationsNode) {
        var children = transformationsNode.children;

        this.transformations = [];

        var grandChildren = [];

        // Any number of transformations.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "transformation") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current transformation.
            var transformationID = this.reader.getString(children[i], 'id');
            if (transformationID == null)
                return "no ID defined for transformation";

            // Checks for repeated IDs.
            if (this.transformations[transformationID] != null)
                return "ID must be unique for each transformation (conflict: ID = " + transformationID + ")";

            grandChildren = children[i].children;
            // Specifications for the current transformation.

            var transfMatrix = mat4.create();

            for (var j = 0; j < grandChildren.length; j++) {
                transfMatrix = this.parseBasicTrasformation(transformationID, grandChildren[j], transfMatrix);

                if (typeof transfMatrix == "string"){ // Error during parsing
                    return transfMatrix;
                }
            }
            this.transformations[transformationID] = transfMatrix;
        }

        this.log("Parsed transformations");
        return null;
    }


    parseBasicTrasformation(parentID, node, matrix){

        if(matrix == null)
            matrix = mat4.create();

        switch (node.nodeName) {
            case 'translate':
                var coordinates = this.parseCoordinates3D(node, "translate transformation for ID " + parentID);
                if (!Array.isArray(coordinates))
                    return "unable to parse coordinates of translation from transformation with ID = " + parentID;

                matrix = mat4.translate(matrix, matrix, coordinates);
                break;
            case 'scale':
                var coordinates = this.parseCoordinates3D(node, "scale transformation for ID " + parentID);
                if (!Array.isArray(coordinates))
                    return "unable to parse coordinates of scale from transformation with ID = " + parentID;

                    matrix = mat4.scale(matrix, matrix, coordinates);
                break;
            case 'rotate':
                
                var axis = this.reader.getString(node, 'axis');
                if (!(axis != null && (axis == 'x' || axis == 'y' || axis == 'z')))
                    return "unable to parse axis of rotation from transformation with ID = " + parentID;

                var angle = this.reader.getFloat(node, 'angle');
                if (!(angle != null && !isNaN(angle)))
                    return "unable to parse angle of rotation from transformation with ID = " + parentID;

                switch(axis){
                    case 'x':
                        matrix = mat4.rotateX(matrix, matrix, angle * DEGREE_TO_RAD);
                        break;
                    case 'y':
                        matrix = mat4.rotateY(matrix, matrix, angle * DEGREE_TO_RAD);
                        break;
                    case 'z':
                        matrix = mat4.rotateZ(matrix, matrix, angle * DEGREE_TO_RAD);
                        break;
                    default:
                        break;
                }

                break;
            default:
                
        }

        return matrix;
    }

    /**
     * Parses the <primitives> block.
     * @param {primitives block element} primitivesNode
     */
    parsePrimitives(primitivesNode) {
        var children = primitivesNode.children;

        this.primitives = [];

        var grandChildren = [];

        // Any number of primitives.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "primitive") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current primitive.
            var primitiveId = this.reader.getString(children[i], 'id');
            if (primitiveId == null)
                return "no ID defined for texture";

            // Checks for repeated IDs.
            if (this.primitives[primitiveId] != null)
                return "ID must be unique for each primitive (conflict: ID = " + primitiveId + ")";

            grandChildren = children[i].children;

            // Validate the primitive type
            if (grandChildren.length != 1 ||
                (grandChildren[0].nodeName != 'rectangle' && grandChildren[0].nodeName != 'triangle' &&
                    grandChildren[0].nodeName != 'cylinder' && grandChildren[0].nodeName != 'sphere' &&
                    grandChildren[0].nodeName != 'torus')) {
                return "There must be exactly 1 primitive type (rectangle, triangle, cylinder, sphere or torus)"
            }

            // Specifications for the current primitive.
            var primitiveType = grandChildren[0].nodeName;

            // Retrieves the primitive coordinates.
            if (primitiveType == 'rectangle') {
                // x1
                var x1 = this.reader.getFloat(grandChildren[0], 'x1');
                if (!(x1 != null && !isNaN(x1)))
                    return "unable to parse x1 of the primitive coordinates for ID = " + primitiveId;

                // y1
                var y1 = this.reader.getFloat(grandChildren[0], 'y1');
                if (!(y1 != null && !isNaN(y1)))
                    return "unable to parse y1 of the primitive coordinates for ID = " + primitiveId;

                // x2
                var x2 = this.reader.getFloat(grandChildren[0], 'x2');
                if (!(x2 != null && !isNaN(x2)))
                    return "unable to parse x2 of the primitive coordinates for ID = " + primitiveId;

                // y2
                var y2 = this.reader.getFloat(grandChildren[0], 'y2');
                if (!(y2 != null && !isNaN(y2)))
                    return "unable to parse y2 of the primitive coordinates for ID = " + primitiveId;

                var rect = new MyRectangle(this.scene, primitiveId, x1, x2, y1, y2);

                this.primitives[primitiveId] = rect;

            } else if (primitiveType == 'cylinder') {
                // base
                var base = this.reader.getFloat(grandChildren[0], 'base');
                if (!(base != null && !isNaN(base)))
                    return "unable to parse base radius of primitive with ID = " + primitiveId;

                // top
                var top = this.reader.getFloat(grandChildren[0], 'top');
                if (!(top != null && !isNaN(top)))
                    return "unable to parse top radius of primitive with ID = " + primitiveId;

                // height
                var height = this.reader.getFloat(grandChildren[0], 'height');
                if (!(height != null && !isNaN(height)))
                    return "unable to parse top height of primitive with ID = " + primitiveId;

                // slices
                var slices = this.reader.getFloat(grandChildren[0], 'slices');
                if (!(slices != null && !isNaN(slices)))
                    return "unable to parse number of slices of primitive with ID = " + primitiveId;

                // stacks
                var stacks = this.reader.getFloat(grandChildren[0], 'stacks');
                if (!(stacks != null && !isNaN(stacks)))
                    return "unable to parse the number of stacks of primitive with ID = " + primitiveId;

                var cylinder = new MyCylinder(this.scene, base, top, height, slices, stacks);

                this.primitives[primitiveId] = cylinder;

            } else if (primitiveType == 'triangle') {

                // x1
                var x1 = this.reader.getFloat(grandChildren[0], 'x1');
                if (!(x1 != null && !isNaN(x1)))
                    return "unable to parse x1 of the primitive coordinates for ID = " + primitiveId;

                // y1
                var y1 = this.reader.getFloat(grandChildren[0], 'y1');
                if (!(y1 != null && !isNaN(y1)))
                    return "unable to parse y1 of the primitive coordinates for ID = " + primitiveId;

                // x2
                var x2 = this.reader.getFloat(grandChildren[0], 'x2');
                if (!(x2 != null && !isNaN(x2)))
                    return "unable to parse x2 of the primitive coordinates for ID = " + primitiveId;

                // y2
                var y2 = this.reader.getFloat(grandChildren[0], 'y2');
                if (!(y2 != null && !isNaN(y2)))
                    return "unable to parse y2 of the primitive coordinates for ID = " + primitiveId;

                // x3
                var x3 = this.reader.getFloat(grandChildren[0], 'x3');
                if (!(x3 != null && !isNaN(x3)))
                    return "unable to parse x3 of the primitive coordinates for ID = " + primitiveId;

                // y3
                var y3 = this.reader.getFloat(grandChildren[0], 'y3');
                if (!(y3 != null && !isNaN(y3)))
                    return "unable to parse y3 of the primitive coordinates for ID = " + primitiveId;

                var triangle = new MyTriangle(this.scene, primitiveId, x1, x2, x3, y1, y2, y3);

                this.primitives[primitiveId] = triangle;

            } else if (primitiveType == 'sphere') {

                // radius
                var radius = this.reader.getFloat(grandChildren[0], 'radius');
                if (!(radius != null && !isNaN(radius)))
                    return "unable to parse radius of the primitive coordinates for ID = " + primitiveId;

                // slices
                var slices = this.reader.getFloat(grandChildren[0], 'slices');
                if (!(slices != null && !isNaN(slices)))
                    return "unable to parse slices of the primitive coordinates for ID = " + primitiveId;

                // stacks
                var stacks = this.reader.getFloat(grandChildren[0], 'stacks');
                if (!(stacks != null && !isNaN(stacks)))
                    return "unable to parse stacks of the primitive coordinates for ID = " + primitiveId;

                var sphere = new MySphere(this.scene, primitiveId, radius, slices, stacks);

                this.primitives[primitiveId] = sphere;

            } else if (primitiveType == 'torus') {

                // inner
                var inner = this.reader.getFloat(grandChildren[0], 'inner');
                if (!(inner != null && !isNaN(inner)))
                    return "unable to parse inner of the primitive coordinates for ID = " + primitiveId;

                // outer
                var outer = this.reader.getFloat(grandChildren[0], 'outer');
                if (!(outer != null && !isNaN(outer)))
                    return "unable to parse outer of the primitive coordinates for ID = " + primitiveId;

                // slices
                var slices = this.reader.getFloat(grandChildren[0], 'slices');
                if (!(slices != null && !isNaN(slices)))
                    return "unable to parse slices of the primitive coordinates for ID = " + primitiveId;

                // loops
                var loops = this.reader.getFloat(grandChildren[0], 'loops');
                if (!(loops != null && !isNaN(loops)))
                    return "unable to parse loops of the primitive coordinates for ID = " + primitiveId;



                var torus = new MyTorus(this.scene, primitiveId, inner, outer, slices, loops);

                this.primitives[primitiveId] = torus;

            }
            else {
                return "undefined primitive with ID = " + primitiveId;
            }
        }

        this.log("Parsed primitives");
        return null;
    }

    copyMaterial(material){

        var mat = new CGFappearance(this.scene);
        mat.setAmbient(...material.ambient);
        mat.setDiffuse(...material.diffuse);
        mat.setEmission(...material.emission);
        mat.setSpecular(...material.specular);
        mat.setShininess(material.shininess);

        return mat;
    }

    /**
   * Parses the <components> block.
   * @param {components block element} componentsNode
   */
    parseComponents(componentsNode) {
        var componentsChildren = componentsNode.children;

        this.components = [];

        var grandChildren = [];
        var grandgrandChildren = [];
        var nodeNames = [];

        // Any number of components.
        for (var i = 0; i < componentsChildren.length; i++) {

            if (componentsChildren[i].nodeName != "component") {
                this.onXMLMinorError("unknown tag <" + componentsChildren[i].nodeName + ">");
                continue;
            }

            // Get id of the current component.
            var componentID = this.reader.getString(componentsChildren[i], 'id');
            if (componentID == null)
                return "no ID defined for componentID";

            // Checks for repeated IDs.
            if (this.components[componentID] != null)
                return "ID must be unique for each component (conflict: ID = " + componentID + ")";

            grandChildren = componentsChildren[i].children;

            nodeNames = [];
            for (var j = 0; j < grandChildren.length; j++) {
                nodeNames.push(grandChildren[j].nodeName);
            }
            
            var transformationIndex = nodeNames.indexOf("transformation");
            var materialsIndex = nodeNames.indexOf("materials");
            var textureIndex = nodeNames.indexOf("texture");
            var childrenIndex = nodeNames.indexOf("children");

            // Transformations
            var nodeTransforms = [];
            var transformationChildren = grandChildren[transformationIndex].children;

            // console.log("children length: " + componentsChildren.length);
            // console.log(componentsChildren);
            // console.log(grandChildren);
            // console.log(this.transformations);
            // console.log("transforms length = " + transformationChildren.length);

            for (var transformIndex = 0; transformIndex < transformationChildren.length; ++transformIndex) {
                var transform = transformationChildren[transformIndex];
                switch(transform.nodeName) {
                    case "transformationref":
                        // Get id of the current transformation.
                        var transformationID = this.reader.getString(transform, 'id');
                        var transformation = this.transformations[transformationID];
                        
                        if (transformationID == null)
                            return "no ID defined for transformation in component with ID = " + componentID;
                        if (transformation == null) 
                            return "transformation with ID = " + transformationID + " not found on component with ID = " + componentID;

                        nodeTransforms.push(transformation);
                        break;
                    case "translate":
                    case "scale":
                    case "rotate":

                        var transfMatrix = mat4.create();

                        transfMatrix = this.parseBasicTrasformation('anonymousID', transform, transfMatrix);

                        if (typeof transfMatrix == "string") { // Error during parsing
                            return transfMatrix;
                        }
                        
                        nodeTransforms.push(transfMatrix);

                        break;
                    default:
                        return "Unsupported transformation: " + transform.nodeName;
                } 
            }
            // console.log("transforms: ");
            // console.log(nodeTransforms);

            // Materials
            var materials = [];
            var materialsChildren = grandChildren[materialsIndex].children;

            for (var j = 0; j < materialsChildren.length; j++){
                // Get id of the current material.
                var materialID = this.reader.getString(materialsChildren[j], 'id');
                var material = this.materials[materialID];

                if (materialID == null && materialID != "inherit")
                    return "no ID defined for material in component with ID = " + componentID;

                if (material == null && materialID != "inherit")
                    return "material with ID = " + materialID + " not found on component with ID = " + componentID;

                if (materialID == 'inherit'){
                    materials.push('inherit');
                } else {
                    materials.push(this.copyMaterial(material));
                }

            }

            // Texture

            var texturesChildren = grandChildren[textureIndex];
            // console.log("texturesChildren");
            // console.log(texturesChildren);

            var textureID = this.reader.getString(texturesChildren, 'id');
            var texture = this.textures[textureID];

            if (textureID == null && textureID != "inherit" && textureID != "none") // TODO remove none
                return "no ID defined for texture in component with ID = " + componentID;

            if (texture == null && textureID != "inherit" && textureID != "none")  // TODO remove none
                return "texture with ID = " + textureID + " not found on component with ID = " + componentID;

            console.log("Initialize :" + textureID + " - id " + componentID);


            // Children
            var children = [];
            var primitiveChildren = []; 
            var childrenChildren = grandChildren[childrenIndex].children;

            for (var childrenIndex = 0; childrenIndex < childrenChildren.length; ++childrenIndex) {
                var child = childrenChildren[childrenIndex];
                var id = this.reader.getString(child, 'id');
                switch(child.nodeName) {
                    case "primitiveref": 
                        if (this.primitives[id] == null) return "primitive not found";
                        
                        primitiveChildren.push(this.primitives[id]);
                        break;
                    case "componentref":
                        console.log("CHILD: " + id);
                        children.push(id);
                        break;
                    default:
                        return "Unsupported child type: " + child.nodeName;
                }
            }

            var node = new MySceneGraphNode(componentID, nodeTransforms, materials, textureID);
            node.addAdjacent(children);
            node.addPrimitives(primitiveChildren);
            this.nodes[componentID] = node;
        }
    }


    /**
     * Parse the coordinates from a node with ID = id
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseCoordinates3D(node, messageError) {
        var position = [];

        // x
        var x = this.reader.getFloat(node, 'x');
        if (!(x != null && !isNaN(x)))
            return "unable to parse x-coordinate of the " + messageError;

        // y
        var y = this.reader.getFloat(node, 'y');
        if (!(y != null && !isNaN(y)))
            return "unable to parse y-coordinate of the " + messageError;

        // z
        var z = this.reader.getFloat(node, 'z');
        if (!(z != null && !isNaN(z)))
            return "unable to parse z-coordinate of the " + messageError;

        position.push(...[x, y, z]);

        return position;
    }

    /**
     * Parse the coordinates from a node with ID = id
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseCoordinates4D(node, messageError) {
        var position = [];

        //Get x, y, z
        position = this.parseCoordinates3D(node, messageError);

        if (!Array.isArray(position))
            return position;


        // w
        var w = this.reader.getFloat(node, 'w');
        if (!(w != null && !isNaN(w)))
            return "unable to parse w-coordinate of the " + messageError;

        position.push(w);

        return position;
    }

    /**
     * Parse the color components from a node
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseColor(node, messageError) {
        var color = [];

        // R
        var r = this.reader.getFloat(node, 'r');
        if (!(r != null && !isNaN(r) && r >= 0 && r <= 1))
            return "unable to parse R component of the " + messageError;

        // G
        var g = this.reader.getFloat(node, 'g');
        if (!(g != null && !isNaN(g) && g >= 0 && g <= 1))
            return "unable to parse G component of the " + messageError;

        // B
        var b = this.reader.getFloat(node, 'b');
        if (!(b != null && !isNaN(b) && b >= 0 && b <= 1))
            return "unable to parse B component of the " + messageError;

        // A
        var a = this.reader.getFloat(node, 'a');
        if (!(a != null && !isNaN(a) && a >= 0 && a <= 1))
            return "unable to parse A component of the " + messageError;

        color.push(...[r, g, b, a]);

        return color;
    }

    /*
     * Callback to be executed on any read error, showing an error on the console.
     * @param {string} message
     */
    onXMLError(message) {
        console.error("XML Loading Error: " + message);
        this.loadedOk = false;
    }

    /**
     * Callback to be executed on any minor error, showing a warning on the console.
     * @param {string} message
     */
    onXMLMinorError(message) {
        console.warn("Warning: " + message);
    }

    /**
     * Callback to be executed on any message.
     * @param {string} message
     */
    log(message) {
        console.log("   " + message);
    }

    keyMPressed(){
        ++this.key_presses;
        this.count = 0;
    }

    dfs(rootID) {
        // for (var node in this.nodes) {
        //     // console.log("reseting key = " + key);
        //     this.nodes[node].visited = false;
        // }

        var rootNode = this.nodes[rootID];

        // if (!rootNode.visited) {
            this.dfs_index = 0;
            var current_matrix = this.scene.getMatrix();
            this.dfs_display(rootNode, current_matrix, "none", undefined);   
            this.count++;      
        // }
    }

    dfs_display(node, transform, texture, material) {

        // if (node.visited)
        //     return;
        
        // calculate transformation matrix for the node and set it 
        var trans = mat4.create();
        for (var i = node.transform.length - 1; i >= 0; i--) {
            mat4.multiply(trans, node.transform[i], trans);
        }
        mat4.multiply(transform, transform, trans);
        this.scene.pushMatrix();
        this.scene.setMatrix(transform); 

        var nodeMaterial = node.material[this.key_presses % node.material.length];

        // if (!node.visited){
        if (this.count == 0){
            if (nodeMaterial == "inherit"){
                node.matDisplay[this.dfs_index] = this.copyMaterial(material);
                console.log("copied material :" + " - id " + node.id);
            } else {
                node.matDisplay[this.dfs_index] = this.copyMaterial(nodeMaterial);
            }
            if (node.texture != "none" && node.texture != "inherit"){
                node.matDisplay[this.dfs_index].setTexture(this.textures[node.texture]);
                // node.material[0].setTextureWrap('REPEAT', 'REPEAT');
                console.log("Text :" + node.texture + " - id " + node.id);
            } else if (node.texture == "inherit") {
                node.matDisplay[this.dfs_index].setTexture(this.textures[texture]);
                // node.material[0].setTextureWrap('REPEAT', 'REPEAT');
                console.log("Text :" + texture + " - id " + node.id);
            } else {
                node.matDisplay[this.dfs_index].setTexture(null);
                console.log("Text :" + 'none' + " - id " + node.id);
            }
        }

        node.matDisplay[this.dfs_index].apply();  // TODO transverse materials

        node.primitives.forEach(primitive => {
            primitive.display();
        });

        // if (node.material[0] != undefined) {
        //     node.material[0].setTexture(null);
        //     node.material[0].apply();  // TODO transverse materials
        // }

        var curIndex = this.dfs_index;

        this.dfs_index++;
        // visit all adjacent nodes recursively and display them
        node.adjacent.forEach(adjacent_id => {
            var adjacent_node = this.nodes[adjacent_id];
            // console.log("Node: " + adjacent_id);
            // if (!adjacent_node.visited) {
                // if (adjacent_node != undefined)
                this.dfs_display(this.nodes[adjacent_id], this.scene.getMatrix(), node.texture == "inherit" ? texture : node.texture, node.matDisplay[curIndex]);
            // }
        });

        this.scene.popMatrix();
    }

    /**
     * Displays the scene, processing each node, starting in the root node.
     */
    displayScene() {
        this.dfs(this.idRoot);

        // this.nodes[this.idRoot].primitives[0].display();

        // this.displayAlternative();

        //To test the parsing/creation of the primitives, call the display function directly
        // this.primitives['cylinder'].display();
        // this.primitives['demoTriangle'].display();
        // this.primitives['demoRectangle'].display();
        // this.primitives['demoSphere'].display();
        // this.primitives['demoTorus'].display();

        // this.scene.popMatrix();
    }

    displayAlternative() {
        this.scene.pushMatrix();

        var triangle1 = new MyTriangle(this.scene, 6464, 0, 0, 1, 1, 0, 0);
        var triangle2 = new MyTriangle(this.scene, 6464, 0, 1, 0, 1, 0, 0);

        this.scene.translate(0, 0.5, 0);  // here

        this.scene.pushMatrix();
        this.scene.translate(0.75, 1, 0);
        triangle1.display();
        triangle2.display();
        this.scene.popMatrix();

        this.scene.rotate(-Math.PI / 2, 0, 1, 0);

        this.scene.pushMatrix();
        this.scene.translate(0.75, 1, 0);
        triangle1.display();
        triangle2.display();
        this.scene.popMatrix();

        this.scene.rotate(-Math.PI / 2, 0, 1, 0);

        this.scene.pushMatrix();
        this.scene.translate(0.75, 1, 0);
        triangle1.display();
        triangle2.display();
        this.scene.popMatrix();

        this.scene.rotate(-Math.PI / 2, 0, 1, 0);

        this.scene.pushMatrix();
        this.scene.translate(0.75, 1, 0);
        triangle1.display();
        triangle2.display();
        this.scene.popMatrix();


        this.scene.popMatrix();



        this.scene.pushMatrix();

        // this.scene.translate(0,0,0);

        // this.scene.scale(7, 5, 7);

        this.scene.rotate(-Math.PI / 2, 1, 0, 0);


        var cylL = new MyCylinder(this.scene, 0.75, 0.75, 4, 10, 6);
        var cylS = new MyCylinder(this.scene, 1.25, 0.01, 1.5, 8, 3);

        this.scene.pushMatrix();
        this.scene.translate(0, 0, 1);
        cylL.display();
        this.scene.popMatrix();

        this.scene.pushMatrix();

        this.scene.translate(0, 0, 5);

        cylS.display();

        this.scene.popMatrix();

        var rect = new MyRectangle(this.scene, "", 0, 2, -1, 1);
        var rect2 = new MyRectangle(this.scene, "", 0, 2, 1, -1);

        this.scene.pushMatrix();
        this.scene.rotate(Math.PI / 2, 1, 0, 0);
        rect.display();
        rect2.display();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        rect.display();
        rect2.display();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        rect.display();
        rect2.display();
        this.scene.rotate(Math.PI / 2, 0, 1, 0);
        rect.display();
        rect2.display();
        this.scene.popMatrix();

        var torus = new MyTorus(this.scene, "", 0.5, 1.5, 10, 10);

        this.scene.pushMatrix();
        this.scene.translate(0, 0, 4);
        torus.display();
        this.scene.popMatrix();

        var sphere = new MySphere(this.scene, "", 1, 10, 10);
        sphere.display();
    }
}