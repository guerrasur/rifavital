# Rifa Vital

Aplicación web simple para administrar una rifa de **150 números** y entregar a cada comprador un certificado digital verificable mediante **link + código QR**.

## Objetivo

Cada número de rifa, del **1 al 150**, corresponde al Pokémon con ese mismo número en la Pokédex de primera generación.

Ejemplos:

- Rifa #1 → Bulbasaur
- Rifa #25 → Pikachu
- Rifa #94 → Gengar
- Rifa #150 → Mewtwo

La aplicación tiene dos partes:

1. una página pública para cada comprador;
2. una página maestra privada para administrar todos los números.

---

## Página pública del certificado

La página pública debe ser deliberadamente básica y minimalista:

- fondo blanco;
- texto negro;
- sin navegación;
- sin elementos decorativos innecesarios.

Debe mostrar:

```text
RIFA #X

Nombre Apellido

[imagen del Pokémon]

TU RIFA: NOMBRE DEL POKÉMON
```

Donde:

- `X` es el número comprado;
- `Nombre Apellido` es el titular asignado desde el panel maestro;
- la imagen corresponde al Pokémon cuyo número de Pokédex coincide con el número de rifa;
- el nombre del Pokémon se muestra debajo de la imagen.

### Pokémon

Se utilizan únicamente los Pokémon **#1 a #150** de la primera generación.

La imagen puede cargarse desde los sprites de Pokémon Red/Blue disponibles en el repositorio público de sprites de PokéAPI.

---

## Link y QR

Cada comprador recibe:

- un **link único** a su certificado;
- un **QR** que apunta exactamente al mismo link.

Ejemplo conceptual:

```text
https://dominio.com/certificado?id=TOKEN_ALEATORIO
```

El identificador público **no debe ser simplemente el número de rifa**.

No usar:

```text
/certificado/25
```

como identificador público único, porque permitiría recorrer fácilmente los certificados de otros compradores.

Cada certificado debe tener un token aleatorio largo y no predecible.

### Persistencia del enlace

Si desde el panel maestro se corrige el nombre de una persona, por ejemplo:

```text
Juan Perez
```

por:

```text
Juan Pérez
```

el **mismo link y el mismo QR deben seguir funcionando**.

Sólo debe cambiar la información mostrada en el certificado.

---

## Página maestra / administración

Debe existir una página privada protegida por autenticación.

La vista maestra muestra permanentemente los **150 números**.

Cada fila debe incluir, como mínimo:

- número de rifa;
- Pokémon correspondiente;
- nombre y apellido del titular;
- estado libre/asignado;
- acciones.

### Funciones

Desde el panel maestro se debe poder:

- ver los números del 1 al 150;
- distinguir números libres y asignados;
- cargar nombre y apellido;
- editar el nombre de un comprador;
- guardar cambios;
- liberar un número borrando su titular;
- buscar por número;
- buscar por nombre;
- buscar por Pokémon;
- abrir el certificado público;
- copiar el link;
- mostrar el QR;
- descargar el QR.

La información de administración no debe ser pública.

---

## Flujo esperado

### Asignar una rifa

1. Entrar al panel maestro.
2. Buscar el número correspondiente.
3. Escribir nombre y apellido del comprador.
4. Guardar.
5. El sistema crea o mantiene el certificado asociado.
6. El sistema genera:
   - link público;
   - QR.
7. Se comparte cualquiera de los dos con el comprador.

### Consultar una rifa

El comprador puede:

- tocar el link; o
- escanear el QR.

Ambos métodos abren la misma página pública.

### Editar una rifa

Si el administrador modifica el nombre:

1. se actualiza el registro;
2. el certificado público refleja el cambio;
3. el token no cambia;
4. el QR y el link anteriores siguen siendo válidos.

---

## Arquitectura propuesta

La app puede funcionar dentro del plan gratuito de Firebase usando:

- **Firebase Hosting** para publicar la web;
- **Cloud Firestore** como base de datos;
- **Firebase Authentication** para proteger el panel maestro.

No requiere un servidor propio para este MVP.

---

## Modelo de datos

### `admins`

Controla quién puede entrar al panel maestro.

Ejemplo:

```text
admins/{uid}
  active: true
```

El `uid` corresponde al usuario administrador creado en Firebase Authentication.

### `tickets`

Información privada de cada número.

Ejemplo conceptual:

```text
tickets/25
  number: 25
  pokemonId: 25
  pokemonName: "Pikachu"
  ownerName: "Nombre Apellido"
  certificateId: "TOKEN_ALEATORIO"
  assigned: true
```

Sólo el administrador debe poder leer o modificar esta colección.

### `certificates`

Información necesaria para renderizar un certificado público.

Ejemplo:

```text
certificates/TOKEN_ALEATORIO
  raffleNumber: 25
  buyerName: "Nombre Apellido"
  pokemonId: 25
  pokemonName: "Pikachu"
  status: "valid"
```

La lectura pública debe permitir únicamente consultar un certificado concreto si ya se conoce su token.

No debe permitirse listar toda la colección públicamente.

---

## Seguridad

Requisitos mínimos:

- el panel maestro requiere login;
- sólo usuarios autorizados pueden editar;
- `tickets` es privado;
- no se puede listar públicamente `certificates`;
- los certificados usan tokens no predecibles;
- no se deben exponer los 150 nombres desde la página pública;
- el número de rifa no funciona como secreto ni como identificador de seguridad.

---

## Firebase — configuración pendiente

Para conectar el proyecto:

1. Crear o seleccionar un proyecto de Firebase.
2. Activar **Cloud Firestore**.
3. Activar **Authentication → Email/Password**.
4. Registrar una **Web App**.
5. Copiar la configuración del SDK web:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
6. Crear el usuario administrador.
7. Copiar su UID.
8. Crear:
   - colección `admins`;
   - documento con ID igual al UID;
   - campo booleano `active: true`.
9. Publicar las reglas de Firestore.
10. Publicar la aplicación en Firebase Hosting.

---

## Diseño

### Certificado público

Prioridad: simplicidad.

- blanco;
- negro;
- centrado;
- tipografía legible;
- Pokémon como elemento visual principal;
- buena visualización en celular.

No debe parecer un dashboard ni una tienda.

### Panel maestro

Puede ser más funcional que visual.

Prioridades:

- lectura rápida;
- búsqueda;
- edición sencilla;
- ver claramente qué números están libres;
- copiar link y obtener QR con pocos pasos;
- responsive para poder administrarlo desde celular.

---

## Alcance inicial

Primera versión:

- 150 números fijos;
- Pokémon #1–150;
- un titular por número;
- link verificable;
- QR;
- edición desde panel maestro;
- Firebase Authentication;
- Firestore;
- Firebase Hosting.

Posibles mejoras futuras:

- marcar pagos;
- fecha de compra;
- teléfono o contacto;
- botón directo para compartir por WhatsApp;
- anular certificados;
- exportar listado;
- historial de cambios;
- impresión de certificados;
- estadísticas de números vendidos y libres.

---

## Estado

La aplicación base ya está implementada en el repositorio y conectada al proyecto Firebase `rifavital`. Queda desplegar las reglas de Firestore y Firebase Hosting para publicarla.


---

## Herramientas de administración agregadas

El panel maestro incluye ahora:

- exportación a Excel (.xlsx) con hojas separadas para todas las rifas, asignadas, libres y reparto 9×16;
- filtros por estado y búsqueda combinada por número, titular o Pokémon;
- carga rápida por lote usando líneas del tipo `25, Nombre Apellido`;
- número libre al azar;
- copia al portapapeles de listas de asignadas o libres;
- reparto de los números 001–144 entre 9 personas, 16 números por persona, con nombres editables y conteo de asignadas/libres por bloque;
- números 145–150 identificados como fuera del reparto 9×16;
- compartir certificados desde el panel mediante el menú nativo del dispositivo o WhatsApp como alternativa;
- QR, copia de link y descarga de QR conservadas.

El certificado público mantiene su diseño simple, pero el sprite del Pokémon se redujo de aproximadamente 280 px a un máximo de 150 px para dar más aire al nombre y al número de rifa.


---

## Actualizaciones y deploy

La aplicación usa `public/version.json` como fuente de versión publicada.

- El panel muestra la versión local y consulta `version.json` sin caché al abrirse, al volver a primer plano y cada 60 segundos.
- Si existe una versión diferente, aparece el botón **Actualizar**.
- El botón limpia cachés/service workers heredados y recarga con parámetros de cache-busting.
- El certificado público también comprueba la versión y se recarga cuando queda abierto durante una publicación nueva.
- `firebase.json` envía headers `no-store/no-cache` para HTML, JS, CSS y `version.json`.

### Flujo para futuras updates

1. Cambiar la constante `VERSION` en `public/app.js` y `public/certificado.js`.
2. Actualizar los query params de versión en `public/index.html` y `public/certificado.html`.
3. Actualizar `public/version.json`.
4. Hacer push a `main`.
5. GitHub Actions ejecuta `.github/workflows/firebase-hosting-deploy.yml` y publica Firebase Hosting.

El workflow acepta una de estas credenciales en GitHub Actions Secrets:

- `FIREBASE_SERVICE_ACCOUNT_RIFAVITAL` (preferida)
- `FIREBASE_TOKEN` (compatibilidad)

Sin una de esas credenciales, el código se sube al repo pero Firebase Hosting no puede recibir el deploy automático.

### Enlaces directos (v1.5.0)

Cada integrante puede abrir su sección directamente con `/?integrante=lucio` (slugs: `juana`, `fede-diez`, `juanma`, `lucio`, `rama`, `fede-torres`, `aye`, `sofi`, `blas`). Estos accesos públicos van al bloque del integrante sin pasar por la contraseña de la portada; volver a la portada conserva su contraseña. Desde Admin están disponibles en **Links de integrantes**, y cada integrante tiene **Copiar mi link**.

**Links de compradores** reúne las rifas guardadas bajo el mismo nombre, ignorando mayúsculas y espacios repetidos. En la sección de un integrante incluye su bloque; desde Admin incluye todas las rifas. Conviene usar nombres completos para distinguir compradores. El enlace `/tus-rifas#ids=…` muestra “Tus rifas:” y tarjetas contiguas con número y Pokémon (dos columnas en celular). Solo lleva los identificadores de los certificados incluidos al copiarlo, sin nombres ni permisos de edición. Las rifas liberadas dejan de aparecer; después de nuevas compras hay que copiar el enlace actualizado. Se conservan los enlaces individuales existentes y las reglas de Firestore.

### Comprobante en forma de carta (v1.6.0)

Los certificados individuales, tanto `/certificado?id=…` como `/r/001?id=…` a `/r/150?id=…`, incluyen un marco negro, el agradecimiento a quienes apoyan la producción y el enlace a [@fiebredeotono](https://instagram.com/fiebredeotono).

La carta se inclina de forma limitada con el sensor de orientación del celular. En iPhone se habilita con **Activar movimiento**, que solicita el permiso del navegador. Si el sensor no está disponible o se rechaza el permiso, la carta responde al dedo o al mouse. Se respeta la preferencia del sistema de reducir movimiento y la impresión conserva una carta plana. Los enlaces, tokens y datos de las rifas se conservan.

### Comprobantes de varias rifas y carga pública (v1.7.0)

`/tus-rifas#ids=…` muestra una carta completa por rifa: número, comprador, Pokémon, agradecimiento e Instagram. Se recorren deslizando horizontalmente, con flechas en pantalla o con el teclado. La carta del centro se agranda y las vecinas asoman a los lados; el movimiento del celular y el reflejo se aplican a la seleccionada. El gesto del dedo queda dedicado a cambiar de carta.

Ambas vistas públicas leen únicamente los certificados indicados en el enlace con la misma conexión de Firestore, configurada para mayor compatibilidad en celulares. Las consultas tienen un tiempo máximo de espera y reintentan errores de conexión transitorios. Un problema de red muestra un mensaje de conexión y **Reintentar**; **Rifa no encontrada** se reserva para identificadores inválidos, documentos inexistentes, rifas anuladas o un número que no coincide con el enlace. No se cambian certificados ni tokens existentes.

La carta incorpora un reflejo diagonal tenue con matices holográficos. Su posición sigue la misma inclinación del sensor, del dedo o del mouse; no intercepta toques y permanece quieto con la preferencia de reducir movimiento.


### Afiche general actualizado (v1.8.0)

En el menú de acceso, junto a Admin y Participantes, **Compartir afiche de rifas** abre el afiche original con cruces rojas sobre los números asignados. Se puede copiar como imagen, compartir con el menú nativo o descargar en PNG. El original está en `public/assets/rifa-fiebre-original.jpeg` sin modificaciones.

La vista consulta los 150 documentos individuales permitidos por las reglas actuales y escucha asignaciones y liberaciones mientras está abierta. Al cerrarla cancela las suscripciones. No utiliza el listado restringido de administración ni modifica las reglas. Espera datos confirmados del servidor para habilitar las acciones; ante una falla oculta la vista previa y permite reintentar. La imagen compartida contiene únicamente el afiche y las cruces, sin nombres ni enlaces de compradores.

### Afiche de los 150 Pokémon (v1.11.0)

Debajo de **Compartir afiche de rifas**, **Compartir afiche de pokemones** abre una grilla de los 150 Pokémon con sus números y nombres. Los libres quedan visibles y los asignados llevan una cruz roja. Utiliza los sprites locales de `public/assets/draw-pokemon/` y muestra el crédito “Fiebre Producciones © 2026”, sin datos de compradores.

Comparte el mismo flujo de datos confirmados del servidor, actualización en vivo, copia de imagen, menú nativo de compartir, descarga PNG y reintento del afiche original. Las acciones se habilitan después de preparar la imagen, para conservar la activación del botón al compartir desde iPhone.

### Sorteo del primer premio (v1.9.0)

La contraseña de la portada se recuerda entre visitas en el mismo navegador mediante un indicador en `localStorage`. No se guarda el texto de la contraseña. Se migra el acceso de una sesión anterior y, si el almacenamiento no está disponible, el ingreso continúa funcionando durante la visita actual. El login de administración mantiene su autenticación independiente.

Admin incluye el botón dorado **Sortear**. La pantalla muestra tres bloques verticales iguales; únicamente el primer premio está habilitado en esta etapa. Las siluetas recorren aleatoriamente los 150 Pokémon, desaceleran, mantienen la ganadora oculta 2,4 segundos y la revelan con un aumento de tamaño de 340 ms. Debajo aparecen número, comprador y vendedor.

Participan solo las rifas asignadas consultadas desde el servidor al iniciar: cada número tiene la misma probabilidad mediante `crypto.getRandomValues` y muestreo por rechazo. La animación visual es independiente de la elección. El nombre del vendedor usa el dato de la rifa y, si falta, su bloque de reparto; para los números fuera del reparto se indica que no hay vendedor registrado.

El resultado y los números participantes se guardan en `draws/first-prize`, con acceso exclusivo de administradores. Una transacción evita sobrescribir un resultado generado simultáneamente desde otro dispositivo y verifica que el número seleccionado siga asignado al mismo comprador. El resultado permanece al recargar; **Volver a sortear** requiere confirmar que se reemplazará el ganador. El botón y el regreso se bloquean durante el proceso. Si se pierde la sesión, la vista se cierra. Con reducción de movimiento se omite el recorrido rápido y la ampliación.

Los 150 sprites transparentes de Red/Blue de [PokéAPI/sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/versions/generation-i/red-blue/transparent) se sirven localmente desde `public/assets/draw-pokemon/`, para que la animación no dependa de un servidor externo.

### Tres premios y pruebas (v1.10.0)

Los tres premios están activos y guardan resultados independientes. Cada animación suma diez segundos rápidos antes de la desaceleración original; se conserva la pausa de 2,4 segundos y la ampliación de 340 ms. Un número ganador queda fuera de los otros premios; un comprador con varias rifas puede ganar con números distintos.

**Reiniciar ganadores** limpia los tres resultados mediante una única transacción, sin modificar rifas, compradores ni certificados. Conserva una marca de reinicio para impedir que una operación de otro dispositivo con resultados antiguos restaure un ganador anterior. Requiere confirmación y queda bloqueado durante las animaciones. Los resultados del primer premio de v1.9.0 se conservan.

Admin incluye **Menú principal**, que mantiene la sesión y permite entrar a Participantes. Desde la pestaña Admin, **Entrar a Admin** vuelve sin pedir credenciales y recarga la tabla completa. **Cerrar sesión** queda separado.
