def execute(String moduleDir, Object master) {
    // seems to be an openSSL issue with phatomJs
    // see https://stackoverflow.com/questions/73004195/phantomjs-wont-install-autoconfiguration-error
    env.OPENSSL_CONF="/dev/null"
    master.defaultNodePipeline(moduleDir)
}

// do not forget this line, otherwise the script cannot be executed
return this