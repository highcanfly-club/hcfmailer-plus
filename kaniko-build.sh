#!/bin/bash
# Tiltfile looks like:
# os. putenv ( 'DOCKER_USERNAME' , 'registry-user' ) 
# os. putenv ( 'DOCKER_PASSWORD' , 'password' ) 
# os. putenv ( 'DOCKER_EMAIL' , 'none@example.org' ) 
# os. putenv ( 'DOCKER_REGISTRY' , 'registry.example.org' ) 
# Namespace='sandbox-hcfp'
# os.putenv('NAMESPACE',Namespace)
# allow_k8s_contexts('kubernetes-admin')
# k8s_yaml(helm('./k8s/helm/hcfmailerplus', name='hcfmailer-plus', namespace=Namespace, values='dev-values.yaml'))
# custom_build('highcanfly/hcfmailer-plus','./kaniko-build.sh',['./autocert', './scripts'],skips_local_docker=True)


#kubectl create secret generic registry-credentials --from-file=.dockerconfigjson=$HOME/.docker/config.json --type=kubernetes.io/dockerconfigjson
#   EXPECTED_REF=serveur/highcanfly_hcfmailer-plus:tilt-build-1683738819
#   EXPECTED_IMAGE=highcanfly_hcfmailer-plus
#   EXPECTED_TAG=tilt-build-1683738819
#   REGISTRY_HOST=server.fqdn
#   EXPECTED_REGISTRY=server.fqdn
kubectl create namespace $NAMESPACE
kubectl create secret -n $NAMESPACE docker-registry registry-credentials --docker-server=$EXPECTED_REGISTRY --docker-username=$DOCKER_USERNAME --docker-password=$DOCKER_PASSWORD --docker-email=$DOCKER_EMAIL
tar -cv --exclude "node_modules" --exclude ".git" --exclude ".github" --exclude-vcs --exclude ".docker" -f -  . | gzip -9 | kubectl run -n $NAMESPACE kaniko \
    --rm --stdin=true \
    --image=gcr.io/kaniko-project/executor:latest --restart=Never \
    --overrides='{
  "apiVersion": "v1",
  "spec": {
    "containers": [
      {
        "name": "kaniko",
        "image": "gcr.io/kaniko-project/executor:latest",
        "stdin": true,
        "stdinOnce": true,
        "args": [
          "-v","info",
          "--dockerfile=Dockerfile",
          "--context=tar://stdin",
          "--skip-tls-verify",
          "--destination='$EXPECTED_REF'"
        ],
        "volumeMounts": [
          {
            "name": "kaniko-secret",
            "mountPath": "/kaniko/.docker"
          }
        ]
      }
    ],
    "volumes": [
      {
        "name": "kaniko-secret",
        "secret": {
          "secretName": "registry-credentials",
          "items": [
            {
              "key": ".dockerconfigjson",
              "path": "config.json"
            }
          ]
        }
      }
    ],
    "restartPolicy": "Never"
  }
}'

#kubectl delete -n $NAMESPACE secret/registry-credentials