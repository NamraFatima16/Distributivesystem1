import { APIGatewayProxyHandlerV2  } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommandInput, QueryCommand } from "@aws-sdk/lib-dynamodb";


const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {

    console.log("[EVENT]", JSON.stringify(event));
    const pathParameters = event?.pathParameters
    let genre = pathParameters?.genre
    if(!genre) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing genre path parameter"})
        }
    }

    try{
        genre = decodeURIComponent(genre)
    } catch (error) {
        console.log("Error decoding genre:", error);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid genre format" })
        };
    }

    const queryParams = event?.queryStringParameters;

    let keyConditionExpression = "Genre = :genre";
    const expressionAttributeValues: any = { ":genre": genre };

    if (queryParams?.ISBN === "") {
        // Handles the case where ISBN is given but is empty
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "ISBN cannot be empty if provided as a query parameter." })
        };
    } else if (queryParams?.ISBN) {
        keyConditionExpression += " and ISBN = :isbn";
        expressionAttributeValues[":isbn"] = queryParams.ISBN;
        delete queryParams.ISBN
    }

    const queryCommand: QueryCommandInput = {
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: keyConditionExpression,
        ExpressionAttributeValues: expressionAttributeValues
    } 

    // Add filtering logic if there is a query parameter given in the URL
    // There is a filterExpression in QueryCommand that filters which items will be
    // returned. 
    let filterExpression: string[] = [];

    if (queryParams?.PublicationYear) {
        const year = parseInt(queryParams.PublicationYear)
        if(!isNaN(year)) { // we have a valid year 
            filterExpression.push("PublicationYear = :year")
            expressionAttributeValues[":year"] = year
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid value for PublicationYear" })
            }
        }
    }
    if (queryParams?.Author) {
        filterExpression.push("Author = :author");
        expressionAttributeValues[":author"] = queryParams.Author
    }

    // Other params than Author or year? Prob model can solve this check
    const validParams = ["Author", "PublicationYear"];
    const unallowedParams = Object.keys(queryParams || {})
        .filter(key => !validParams.includes(key))
    if (unallowedParams.length > 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: `Unknown query parameter(s): ${unallowedParams.join(", ")}` })
        }
    }

    if (filterExpression.length > 0) {
        queryCommand.FilterExpression = filterExpression.join(" AND ")
        queryCommand.ExpressionAttributeValues = expressionAttributeValues
    }

    try {
        const queryOutput = await ddbDocClient.send(new QueryCommand(queryCommand));
        if (!queryOutput.Items || queryOutput.Items.length === 0) {
            // Check a filter was applied - stackoverflow for the || {}
            // the queryStringPara can be undefined so object.keys will err
            // if its undefined (false) we give an empty {} instead
            if (Object.keys(event.queryStringParameters || {} ).length === 0) {                
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: `No books found for genre: ${genre}`})
                }
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify(queryOutput.Items)
        }
    } catch(error: any) {
        console.log("Error retrieving books: ", JSON.stringify(error));
        return {
            statusCode: 500,
            body: JSON.stringify( {error: "Could not retrieve books by genre" })
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