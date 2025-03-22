import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { ReturnValue } from "@aws-sdk/client-dynamodb";
import { StringDefinitionBody } from "aws-cdk-lib/aws-stepfunctions";

const ddbDocClient = createDDbDocClient();
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: Handler = async (event, context) => {
  let language: string | undefined; // Declare language outside try block

  try {
    console.log("Translating book description. Event: ", JSON.stringify(event));
    const author = event.pathParameters?.author;
    const isbn = event.pathParameters?.isbn;
    language = event.queryStringParameters?.language; // Assign language here

    if (!author || !isbn || !language) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing author, isbn, or language parameters." }),
      };
    }

    const getCommandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { Author: author, ISBN: isbn },
      })
    );

    if (!getCommandOutput.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Book not found." }),
      };
    }

    const description = getCommandOutput.Item.Description;
    let translatedText;

    // Initialize TranslatedDescriptions if it's undefined
    if (!getCommandOutput.Item.TranslatedDescriptions) {
      getCommandOutput.Item.TranslatedDescriptions = {};
    }

    if (getCommandOutput.Item.TranslatedDescriptions[language]) {
      translatedText = getCommandOutput.Item.TranslatedDescriptions[language];
      console.log(`Translation found in cache for ${language}.`);
    } else {
      const translateCommand = new TranslateTextCommand({
        Text: description,
        SourceLanguageCode: "en",
        TargetLanguageCode: language,
      });

      const translateOutput = await translateClient.send(translateCommand);
      translatedText = translateOutput.TranslatedText;


 

      const updateParams = {
        TableName: process.env.TABLE_NAME as string,
        Key: {
          Author: author as string,
          ISBN: isbn as string,
        },
        UpdateExpression: "SET TranslatedDescriptions.#lang = :translatedText",
        ExpressionAttributeNames: { "#lang": language },
        ExpressionAttributeValues: { ":translatedText": translatedText },
        ReturnValues: ReturnValue.UPDATED_NEW,
      };

      await ddbDocClient.send(new UpdateCommand(updateParams));
    

      console.log(`Translation added to cache for ${language}.`);
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...getCommandOutput.Item,
        TranslatedDescription: translatedText,
      }),
    };
  } catch (error: any) {
    console.log("Error translating book description: ", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error: `Failed to translate book description for ${language}.` }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}