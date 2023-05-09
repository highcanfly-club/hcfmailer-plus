// Copyright 2023 Ronan Le Meillat.
// autocert is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// autocert is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with oci-manage.  If not, see <https://www.gnu.org/licenses/agpl-3.0.html>.

/*
package main provides a simple tool for extracting tls.crt and tls.key from a Kubernetes secret
# usage
autocert -cert-dir=path_where_certs_will_be_stored -dns-name=base_name -secret=name_of_the_k8s_secret
*/
package main

import (
	"context"
	"encoding/pem"
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var CERT_DIR = ""
var CLOUDFLARE_DNS_RECORDS = ""

func getCurrentContext() string {
	content, err := ioutil.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace")
	if err != nil {
		return "default"
	}
	return string(content)
}

func getCertificate(certChain string) string {
	block, _ := pem.Decode([]byte(certChain))
	if block == nil {
		panic("failed to decode PEM block containing public key")
	}
	pemText := string(pem.EncodeToMemory(block))
	return pemText
}

func save(content string, file string) error {
	f, err := os.Create(file)
	if err == nil {
		f.WriteString(content)
		f.Close()
	}
	return err
}

func saveCertificate(cert string, certChain string, key string) {
	certPemFile := fmt.Sprintf("%s/%s.pem", CERT_DIR, CLOUDFLARE_DNS_RECORDS)
	certChainPemFile := fmt.Sprintf("%s/%s-full.pem", CERT_DIR, CLOUDFLARE_DNS_RECORDS)
	certKeyPemFile := fmt.Sprintf("%s/%s.key", CERT_DIR, CLOUDFLARE_DNS_RECORDS)
	// save cert
	err := save(cert, certPemFile)
	if err != nil {
		panic(err)
	}

	// save fullchain
	err = save(certChain, certChainPemFile)
	if err != nil {
		panic(err)
	}

	// save key
	err = save(key, certKeyPemFile)
	if err != nil {
		panic(err)
	}
}

func main() {
	var help = flag.Bool("help", false, "Show help")
	var secretName string
	flag.StringVar(&CERT_DIR, "cert-dir", os.Getenv("CERT_DIR"), "Directory where the certificates are stored - must exists")
	flag.StringVar(&CLOUDFLARE_DNS_RECORDS, "dns-name", os.Getenv("CLOUDFLARE_DNS_RECORDS"), "Certificate base name ex: --dns-name=www.example.com gives www.example.com.pem www.example.com-full.pem and www.example.com.key")
	flag.StringVar(&secretName, "secret", os.Getenv("CERT_SECRET"), "Kubernetes name of the secret hosting tls.crt and tls.key (must be in the same namespace)")
	// Parse the flags
	flag.Parse()

	// Usage Demo
	if *help {
		flag.Usage()
		os.Exit(0)
	}
	currentNamespace := getCurrentContext()

	// creates the in-cluster config
	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}

	// creates the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	context := context.TODO()

	secret, err := clientset.CoreV1().Secrets(currentNamespace).Get(
		context, secretName, metav1.GetOptions{})
	if err != nil {
		panic(err.Error())
	}

	tlsCrtChain := string(secret.Data["tls.crt"])
	tlsKey := string(secret.Data["tls.key"])
	if tlsCrtChain != "" && tlsKey != "" {
		tlsCrt := getCertificate(tlsCrtChain)
		saveCertificate(tlsCrt, tlsCrtChain, tlsKey)
	} else {
		panic("unknown error")
	}
}
