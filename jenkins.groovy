def execute(String moduleDir, Object master) {
    // if needed (currently via build script):
    // add bower and grunt to the path, it's needed
    // env.PATH = "/insts/bower/versions/1.8.14/bin:/insts/grunt/versions/1.2.0/bin:${env.PATH}"

    // seems to be an openSSL issue with phatomJs
    // see https://stackoverflow.com/questions/73004195/phantomjs-wont-install-autoconfiguration-error
    env.OPENSSL_CONF="/dev/null"
    master.defaultNodePipeline(moduleDir)
}

// do not forget this line, otherwise the script cannot be executed
return this