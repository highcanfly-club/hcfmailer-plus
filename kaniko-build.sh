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
echo "NAMESPACE=$NAMESPACE MODULEPATH=$MODULEPATH MODULENAME=$MODULENAME"
echo "REGISTRY: $DOCKER_REGISTRY"
echo "CACHE REGISTRY: $DOCKER_CACHE_REGISTRY"
KANIKO_POD=$(kubectl -n $NAMESPACE get pods | grep "kaniko" | cut -d' ' -f1)
BAD_RANDOM=$(echo $RANDOM-$RANDOM-$RANDOM-$RANDOM | openssl dgst -sha1 -r | awk '{print $1}' | tr -d '\n' )
echo "CURRENT KANIKO POD is kaniko-$BAD_RANDOM"
kubectl -n $NAMESPACE delete pod --wait=false $KANIKO_POD 2>/dev/null
cat << EOF | kubectl -f apply -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: $NAMESPACE
  name: secret-reader
rules:
- apiGroups: [""] # "" indicates the core API group
  resources: ["secrets"]  #grants reading namespace pods and secrets
  verbs: ["get", "watch", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: secret-reader
  namespace: $NAMESPACE
subjects:
- kind: ServiceAccount
  name: default # "name" is case sensitive
  namespace: $NAMESPACE
roleRef:
  kind: Role #this must be Role or ClusterRole
  name: secret-reader 
  apiGroup: rbac.authorization.k8s.io
---
EOF
tar -cv --exclude "node_modules" --exclude "dkim.rsa" --exclude "private" --exclude "k8s" --exclude ".git" --exclude ".github" --exclude-vcs --exclude ".docker" --exclude "_sensitive_datas" -f - . \
  | gzip -9 | kubectl run -n $NAMESPACE kaniko-$BAD_RANDOM \
  --rm --stdin=true \
  --image=highcanfly/kaniko:latest --restart=Never \
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
          "--cache=true",
          "--dockerfile=Dockerfile",
          "--context=tar://stdin",
          "--skip-tls-verify",
          "--destination='$EXPECTED_REF'",
          "--image-fs-extract-retry=3",
          "--push-retry=3",
          "--use-new-run",
          "--cache=true",
          "--cache-ttl=24h",
          "--cache-repo='$DOCKER_CACHE_REGISTRY'"
        ]
      }
    ],
    "restartPolicy": "Never"
  }
}'

#kubectl delete -n $NAMESPACE secret/registry-credentials
