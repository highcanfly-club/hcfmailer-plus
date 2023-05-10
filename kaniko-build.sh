#!/bin/bash
#kubectl create secret generic registry-credentials --from-file=.dockerconfigjson=$HOME/.docker/config.json --type=kubernetes.io/dockerconfigjson


kubectl create secret docker-registry registry-credentials --docker-server=$DOCKER_REGISTRY --docker-username=$DOCKER_USERNAME --docker-password=$DOCKER_PASSWORD --docker-email=$DOCKER_EMAIL
tar -cv --exclude "node_modules" --exclude ".git" --exclude ".github" --exclude-vcs --exclude ".docker" -f -  . | gzip -9 | kubectl run -n sandbox-hcfp kaniko \
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
          "--destination='$REFERENCE'"
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
kubectl delete secret registry-credentials