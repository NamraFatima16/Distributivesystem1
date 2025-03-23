import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {

  console.log("[EVENT]", JSON.stringify(event));
  const body = event.body ? JSON.parse(event.body) : undefined;
  if (!body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing request body" })
    }
  }

  // API gateway model should take care of this wtih the bookmodel
  if (!body?.Genre || !body.ISBN) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Missing required fields in the request body (e.g., Genre, ISBN)" })
    }
  }
  
  //what happens if there is already the same part+sort key item in db?
  try {
    const commandOutput = await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: body,
      })
    )
    return {
      statusCode: 201,
      body: JSON.stringify({ message: "Book added" })
    }
  } catch (error: any) {
    console.log("Error adding books: ", JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not add book" })
    }
  }
}

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
