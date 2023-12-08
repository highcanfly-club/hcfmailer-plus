allow_k8s_contexts('kubernetes-admin@kubernetes')

Namespace='sandbox-hcfp'
datei=str(local("date -I| openssl dgst -sha1 -r | awk '{print $1}' | tr -d '\n'"))
sha1=str(local("cat Dockerfile | openssl dgst -sha1 -r | awk '{print $1}' | tr -d '\n'"))
CacheRegistry='ttl.sh/sanbox-cache-dev-'+datei+'-cache'
Registry='ttl.sh/sanbox-odoo-dev-'+sha1

load('ext://helm_resource', 'helm_resource', 'helm_repo')
load('ext://namespace', 'namespace_create')
default_registry(Registry)
namespace_create(Namespace)

os.putenv ( 'NAMESPACE' , Namespace )
os.putenv ( 'DOCKER_REGISTRY' , Registry ) 
os.putenv ( 'DOCKER_CACHE_REGISTRY' , CacheRegistry ) 

custom_build('highcanfly/hcfmailer-plus','./kaniko-build.sh',[
  './server',
  './client',
  './zone-mta',
  './shared',
  './mvis',
  './setup',
  './proxy',
  './locales',
  './autocert'
],skips_local_docker=True, 
  live_update=[
    sync('./server', '/app/server/'),
    sync('./client', '/app/client/'),
    sync('./zone-mta', '/app/zone-mta/'),
    sync('./shared','/app/shared/'),
    sync('./mvis','/app/mvis/'),
    sync('./setup','/app/setup/'),
    sync('./proxy','/app/proxy/'),
    sync('./locales','/app/locales/'),
    sync('./autocert','/app/autocert/')
])

#helm_repo('bitnami', 'https://charts.bitnami.com/bitnami')
helm_resource('hcfmailer-plus', 
              './k8s/helm/hcfmailerplus', 
              image_deps=['highcanfly/hcfmailer-plus'],
              image_keys=[('image.repository', 'image.tag')],
              namespace=Namespace,
              flags=['--values=./dev-values.yaml'])
