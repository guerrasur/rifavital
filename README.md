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

Actualmente el proyecto está en etapa de implementación y configuración de Firebase.
