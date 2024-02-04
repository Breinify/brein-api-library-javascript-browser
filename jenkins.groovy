def execute(String moduleDir, Object master) {
    // add bower and grunt to the path, it's needed
    env.PATH = "/insts/bower/versions/1.8.14/bin:/insts/grunt/versions/1.2.0/bin:${env.PATH}"

    master.defaultNodePipeline(moduleDir)
}

// do not forget this line, otherwise the script cannot be executed
return this