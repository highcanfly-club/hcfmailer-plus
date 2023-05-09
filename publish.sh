#!/bin/bash
TAG=$1
echo $TAG
sed -i .bak "s/^appVersion: .*/appVersion: \"$TAG\"/g" ./k8s/helm/hcfmailerplus/Chart.yaml
git commit -m "Update chart appVersion to $TAG" ./k8s/helm/hcfmailerplus/Chart.yaml
git tag
git push --tags && gh --repo highcanfly-club/hcfmailer-plus release create $TAG --notes "build $TAG"
