## Serverless REST Assignment - Distributed Systems.

_Name:_ Namra Fatima.

_Demo:_ (https://youtu.be/sNU49gq4OjE)

### Context.

Context: Book Library

Genre - string (Partition key)
ISBN - string (Sort Key)
Title - string
Author - string
PublicationYear - number
Description - string
TranslatedDescriptions - Map<string, string>

### App API endpoints.

POST /books - Add a new book to the library.
GET /books/{genre} - Get all books of a specific genre.
GET /books/{genre}?Author=value - Get all books of a specific genre written by a particular author.
GET /books/{genre}?PublicationYear=value - Get all books of a specific genre published in a specific year.
PUT /books/{genre}/{ISBN} - Update details for a specific book.
GET /books/{genre}/{ISBN}/translation?language=value - Get a book's details with the description translated to the specified language.


### Features.

#### Translation persistence (if completed)

 implementation translation persistence by storing translated descriptions in a map attribute called TranslatedDescriptions. When a translation is requested for the first time, the Lambda function calls Amazon Translate to translate the book's description to the requested language, then stores it in the TranslatedDescriptions map using the language code as the key.

Genre - string (Partition key)
ISBN - string (Sort Key)
Title - string
Author - string
PublicationYear - number
Description - string (original English description)
TranslatedDescriptions - Map<string, string>

